`%||%` <- function(a,b) if (is.null(a)) b else a
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) stop("Uso: Rscript lavaan_engine.R request.json response.json")

suppressPackageStartupMessages({
  library(jsonlite)
  library(lavaan)
})

req <- fromJSON(args[1], simplifyVector = FALSE)
out_file <- args[2]

safe_num <- function(x) {
  if (length(x) == 0 || is.null(x) || is.na(x)) return(NULL)
  as.numeric(x)
}

capture_lavaan_fit <- function(expr) {
  warnings_text <- character()
  fit <- withCallingHandlers(
    expr,
    warning = function(w) {
      warnings_text <<- c(warnings_text, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
  list(fit=fit, warnings_text=unique(warnings_text))
}

available_fit_measures <- function(fit, requested) {
  all_names <- names(fitMeasures(fit))
  use <- intersect(requested, all_names)
  if (!length(use)) return(list())
  fm <- fitMeasures(fit, use)
  out <- as.list(unname(fm))
  names(out) <- names(fm)
  out
}

is_ordinal_column <- function(x, max_categories=7) {
  x <- x[!is.na(x)]
  if (!length(x) || !is.numeric(x)) return(FALSE)
  ux <- unique(x)
  length(ux) >= 2 && length(ux) <= max_categories && all(abs(ux - round(ux)) < 1e-10)
}

mardia_test <- function(dat) {
  # Mardia is intended for continuous multivariate data. For ordered categorical
  # indicators it is returned only as descriptive information and must not be used
  # to override the choice of an ordinal estimator such as WLSMV.
  x <- as.data.frame(dat)
  x <- x[vapply(x, is.numeric, logical(1))]
  x <- x[complete.cases(x), , drop=FALSE]
  n <- nrow(x); p <- ncol(x)
  if (p < 2 || n < 5) {
    return(list(ok=FALSE, reason="Se requieren al menos 2 variables numéricas y 5 casos completos."))
  }
  if (n <= p) {
    return(list(ok=FALSE, n=n, p=p, reason="La prueba de Mardia requiere una matriz de covarianzas invertible; se recomienda n > p."))
  }
  X <- as.matrix(x)
  mu <- colMeans(X)
  Z <- sweep(X, 2, mu, "-")
  # Population covariance (divide by n), consistent with the classical Mardia form.
  S <- crossprod(Z) / n
  Sinv <- tryCatch(solve(S), error=function(e) NULL)
  if (is.null(Sinv) || any(!is.finite(Sinv))) {
    return(list(ok=FALSE, n=n, p=p, reason="La matriz de covarianzas es singular o numéricamente inestable."))
  }
  A <- Z %*% Sinv %*% t(Z)
  b1p <- sum(A^3) / (n^2)
  skew_chisq <- n * b1p / 6
  skew_df <- p * (p + 1) * (p + 2) / 6
  skew_p <- pchisq(skew_chisq, df=skew_df, lower.tail=FALSE)

  d2 <- diag(A)
  b2p <- mean(d2^2)
  expected_b2p <- p * (p + 2)
  kurt_z <- (b2p - expected_b2p) / sqrt(8 * p * (p + 2) / n)
  kurt_p <- 2 * pnorm(abs(kurt_z), lower.tail=FALSE)

  normal <- is.finite(skew_p) && is.finite(kurt_p) && skew_p >= .05 && kurt_p >= .05
  list(
    ok=TRUE, n=n, p=p,
    skewness=list(b1p=safe_num(b1p), statistic=safe_num(skew_chisq), df=safe_num(skew_df), pvalue=safe_num(skew_p)),
    kurtosis=list(b2p=safe_num(b2p), expected=safe_num(expected_b2p), z=safe_num(kurt_z), pvalue=safe_num(kurt_p)),
    multivariate_normal=normal
  )
}

result <- tryCatch({
  dat <- read.csv(text = req$csv_text, check.names = FALSE)

  # Remove ID even if it is numeric, and exclude previously derived scale scores.
  if (ncol(dat) > 1 && tolower(trimws(names(dat)[1])) %in% c("id","idem","folio","participante","sujeto","caso")) {
    dat <- dat[, -1, drop=FALSE]
  }
  derived <- grepl("^(D[0-9]+_media|Total_media|Total_suma)$", names(dat), ignore.case=TRUE)
  if (any(derived) && sum(!derived) >= 2) dat <- dat[, !derived, drop=FALSE]

  # Coerce columns that are entirely numeric-looking.
  for (nm in names(dat)) {
    if (!is.numeric(dat[[nm]])) {
      raw <- trimws(as.character(dat[[nm]]))
      num <- suppressWarnings(as.numeric(raw))
      nonempty <- raw != "" & !is.na(raw)
      if (all(!nonempty | is.finite(num))) dat[[nm]] <- num
    }
  }

  requested_estimator <- toupper(req$estimator %||% "AUTO")
  requested_data_type <- tolower(req$data_type %||% "auto")
  missing_mode <- tolower(req$missing %||% "fiml")
  boot <- as.integer(req$bootstrap %||% 0)

  requested_ordinal <- unlist(req$ordinal_vars %||% list())
  requested_ordinal <- intersect(requested_ordinal, names(dat))
  numeric_names <- names(dat)[vapply(dat, is.numeric, logical(1))]
  auto_ordinal <- length(numeric_names) > 0 && all(vapply(dat[numeric_names], is_ordinal_column, logical(1)))

  data_type <- if (requested_data_type %in% c("ordinal","continuous")) {
    requested_data_type
  } else if (length(requested_ordinal) || auto_ordinal) {
    "ordinal"
  } else {
    "continuous"
  }

  mardia <- mardia_test(dat)

  estimator_recommendation <- if (identical(data_type, "ordinal")) {
    list(
      estimator="WLSMV",
      reason="Los indicadores se tratan como ordinales. WLSMV/DWLS robusto es preferible a ML para ítems categóricos ordenados.",
      mardia_role="La prueba de Mardia no determina el estimador cuando los indicadores son ordinales; se conserva sólo como diagnóstico descriptivo."
    )
  } else if (isTRUE(mardia$ok) && isTRUE(mardia$multivariate_normal)) {
    list(
      estimator="ML",
      reason="Los indicadores son continuos y Mardia no detectó evidencia estadística de desviación de normalidad multivariante al nivel .05.",
      mardia_role="Mardia apoya la elección entre ML convencional y una variante robusta para datos continuos."
    )
  } else {
    list(
      estimator="MLR",
      reason="Los indicadores son continuos y la normalidad multivariante no está apoyada o no pudo establecerse con seguridad; se recomienda ML robusto (MLR).",
      mardia_role="MLR usa errores estándar robustos y una prueba escalada; la decisión no debe depender exclusivamente de un p-valor."
    )
  }

  estimator <- if (requested_estimator %in% c("AUTO","AUTOMATIC","RECOMMENDED")) {
    estimator_recommendation$estimator
  } else {
    requested_estimator
  }

  # Guardrail: do not silently use ML/MLR for ordered indicators.
  estimator_override_note <- NULL
  if (identical(data_type, "ordinal") && estimator %in% c("ML","MLR","MLM","MLMV","MLMVS")) {
    estimator_override_note <- paste0("Se solicitó ", estimator, " con indicadores ordinales. ValiStruct cambió a WLSMV para evitar una especificación incompatible en lavaan.")
    estimator <- "WLSMV"
  }

  ordered_vars <- NULL
  if (length(requested_ordinal)) {
    ordered_vars <- requested_ordinal
  } else if (identical(data_type, "ordinal") || identical(estimator, "WLSMV")) {
    ordered_vars <- numeric_names
  }

  missing_guidance <- character()
  if (estimator %in% c("ML","MLR","MLM","MLMV","MLMVS")) {
    if (missing_mode %in% c("fiml","ml","ml.x")) {
      lavaan_missing <- "fiml"
    } else if (missing_mode %in% c("listwise","complete")) {
      lavaan_missing <- "listwise"
    } else {
      lavaan_missing <- "fiml"
      missing_guidance <- c(missing_guidance,
        paste0("La estrategia de datos perdidos '", missing_mode,
               "' no es compatible con ", estimator,
               " en esta implementación; se utilizó FIML."))
    }
  } else {
    if (missing_mode %in% c("pairwise","listwise")) {
      lavaan_missing <- missing_mode
    } else {
      lavaan_missing <- "pairwise"
      missing_guidance <- c(missing_guidance,
        paste0("Para ", estimator,
               " se utilizó missing='pairwise' en lugar de '", missing_mode, "'."))
    }
  }

  fit_capture <- capture_lavaan_fit(
    sem(
      model = req$syntax,
      data = dat,
      estimator = estimator,
      missing = lavaan_missing,
      ordered = ordered_vars,
      std.lv = TRUE,
      meanstructure = TRUE,
      se = if (boot > 0 && estimator %in% c("ML","MLR")) "bootstrap" else "standard",
      bootstrap = if (boot > 0) boot else 1000
    )
  )
  fit <- fit_capture$fit
  warnings_text <- fit_capture$warnings_text

  converged <- isTRUE(lavInspect(fit, "converged"))
  post_check <- isTRUE(lavInspect(fit, "post.check"))

  base_names <- c(
    "chisq","df","pvalue","cfi","tli","rmsea","rmsea.ci.lower",
    "rmsea.ci.upper","rmsea.pvalue","srmr","aic","bic"
  )
  robust_names <- c(
    "chisq.scaled","df.scaled","pvalue.scaled",
    "cfi.scaled","tli.scaled","rmsea.scaled",
    "rmsea.ci.lower.scaled","rmsea.ci.upper.scaled",
    "cfi.robust","tli.robust","rmsea.robust",
    "rmsea.ci.lower.robust","rmsea.ci.upper.robust"
  )
  fit_standard <- available_fit_measures(fit, base_names)
  robust_estimators <- c("MLR","MLM","MLMV","MLMVS","WLSMV","WLSM","WLSMVS","ULSMV","ULSM")
  fit_robust <- if (estimator %in% robust_estimators) available_fit_measures(fit, robust_names) else list()

  pe <- parameterEstimates(fit, standardized=TRUE)
  params <- lapply(seq_len(nrow(pe)), function(i) {
    list(
      lhs = pe$lhs[i], op = pe$op[i], rhs = pe$rhs[i],
      est = safe_num(pe$est[i]), se = safe_num(pe$se[i]),
      z = safe_num(pe$z[i]), pvalue = safe_num(pe$pvalue[i]),
      std_all = safe_num(pe$std.all[i])
    )
  })

  neg_var <- pe[pe$op=="~~" & pe$lhs==pe$rhs & !is.na(pe$est) & pe$est < 0, , drop=FALSE]
  extreme_loading <- pe[pe$op=="=~" & !is.na(pe$std.all) & abs(pe$std.all) > 1, , drop=FALSE]
  heywood <- nrow(neg_var) > 0 || nrow(extreme_loading) > 0

  mi_list <- list()
  if (converged) {
    mi <- tryCatch(modificationIndices(fit, sort.=TRUE, minimum.value=3.84), error=function(e) NULL)
    if (!is.null(mi)) {
      if (nrow(mi) > 100) mi <- mi[1:100, , drop=FALSE]
      mi_list <- lapply(seq_len(nrow(mi)), function(i) {
        list(lhs=mi$lhs[i], op=mi$op[i], rhs=mi$rhs[i], mi=safe_num(mi$mi[i]), epc=safe_num(mi$epc[i]))
      })
    }
  }

  guidance <- c()
  if (!is.null(estimator_override_note)) guidance <- c(guidance, estimator_override_note)
  guidance <- c(guidance, paste0("Estimador utilizado: ", estimator, ". ", estimator_recommendation$reason))

  if (identical(data_type, "continuous") && isTRUE(mardia$ok)) {
    guidance <- c(guidance,
      paste0("Mardia: asimetría p=", formatC(mardia$skewness$pvalue, format="f", digits=4),
             "; curtosis p=", formatC(mardia$kurtosis$pvalue, format="f", digits=4), "."))
  }
  if (identical(data_type, "ordinal")) {
    guidance <- c(guidance,
      "Indicadores ordinales: la elección de WLSMV se basa en el nivel de medición, no en superar una prueba de normalidad multivariante.")
  }

  if (!converged) guidance <- c(guidance, "ALERTA CRÍTICA: el modelo no convergió. No interprete ni reporte los índices de ajuste o parámetros como resultados definitivos.")
  if (!post_check) guidance <- c(guidance, "La verificación posterior de lavaan detectó una solución potencialmente impropia.")
  if (heywood) guidance <- c(guidance, "Se detectó un posible caso Heywood (varianza negativa y/o carga estandarizada > |1|). Revise especificación, datos e identificación.")
  if (length(warnings_text)) guidance <- c(guidance, "lavaan emitió advertencias durante el ajuste; revíselas antes de interpretar el modelo.")

  cfi_for_guidance <- fit_robust[["cfi.robust"]] %||% fit_robust[["cfi.scaled"]] %||% fit_standard[["cfi"]]
  tli_for_guidance <- fit_robust[["tli.robust"]] %||% fit_robust[["tli.scaled"]] %||% fit_standard[["tli"]]
  rmsea_for_guidance <- fit_robust[["rmsea.robust"]] %||% fit_robust[["rmsea.scaled"]] %||% fit_standard[["rmsea"]]
  srmr_for_guidance <- fit_standard[["srmr"]]

  if (!is.null(cfi_for_guidance)) {
    if (cfi_for_guidance >= .95) guidance <- c(guidance, "CFI muestra ajuste comparativo favorable.")
    else if (cfi_for_guidance >= .90) guidance <- c(guidance, "CFI es aceptable, pero conviene revisar el modelo junto con otros índices.")
    else guidance <- c(guidance, "CFI sugiere ajuste insuficiente; revise especificación y teoría.")
  }
  if (!is.null(tli_for_guidance)) {
    if (tli_for_guidance >= .95) guidance <- c(guidance, "TLI muestra ajuste incremental favorable.")
    else if (tli_for_guidance < .90) guidance <- c(guidance, "TLI sugiere ajuste insuficiente; interprete junto con CFI, RMSEA y SRMR.")
  }
  if (!is.null(rmsea_for_guidance)) {
    if (rmsea_for_guidance <= .06) guidance <- c(guidance, "RMSEA muestra error de aproximación bajo.")
    else if (rmsea_for_guidance <= .08) guidance <- c(guidance, "RMSEA se encuentra en rango razonable.")
    else guidance <- c(guidance, "RMSEA es elevado; revise el modelo.")
  }
  if (!is.null(srmr_for_guidance)) {
    if (srmr_for_guidance <= .08) guidance <- c(guidance, "SRMR se encuentra en rango favorable.")
    else guidance <- c(guidance, "SRMR sugiere discrepancias residuales relevantes.")
  }

  guidance <- c(guidance, missing_guidance,
    "La rotación ortogonal/oblicua corresponde al AFE y no es una alternativa a ML, MLR o WLSMV en AFC.",
    "No modifique el modelo únicamente para mejorar índices de ajuste; conserve sustento teórico.")

  list(
    ok = TRUE,
    estimator_requested = requested_estimator,
    estimator = estimator,
    estimator_recommendation = estimator_recommendation,
    data_type = data_type,
    auto_detected_ordinal = auto_ordinal,
    mardia = mardia,
    n = nrow(dat),
    converged = converged,
    post_check = post_check,
    heywood = heywood,
    improper_solution = (!post_check || heywood),
    warnings_text = warnings_text,
    fit = fit_standard,
    fit_robust = fit_robust,
    missing_used = lavaan_missing,
    ordered_vars = ordered_vars %||% list(),
    parameters = params,
    modification_indices = mi_list,
    guidance = unique(guidance)
  )
}, error = function(e) {
  list(ok=FALSE, error=conditionMessage(e))
})

write(toJSON(result, auto_unbox=TRUE, pretty=TRUE, na="null", digits=15), out_file)

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

result <- tryCatch({
  dat <- read.csv(text = req$csv_text, check.names = FALSE)

  if (ncol(dat) > 1 && !is.numeric(dat[[1]]) &&
      tolower(names(dat)[1]) %in% c("id","folio","participante","sujeto","caso")) {
    dat <- dat[, -1, drop=FALSE]
  }

  estimator <- toupper(req$estimator %||% "MLR")
  data_type <- req$data_type %||% "continuous"
  missing_mode <- tolower(req$missing %||% "fiml")
  boot <- as.integer(req$bootstrap %||% 0)

  requested_ordinal <- unlist(req$ordinal_vars %||% list())
  requested_ordinal <- intersect(requested_ordinal, names(dat))
  ordered_vars <- NULL
  if (length(requested_ordinal)) {
    ordered_vars <- requested_ordinal
  } else if (identical(data_type, "ordinal") || identical(estimator, "WLSMV")) {
    ordered_vars <- names(dat)
  }

  missing_guidance <- character()
  if (estimator %in% c("ML","MLR")) {
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
    "rmsea.ci.upper","srmr","aic","bic"
  )
  robust_names <- c(
    "chisq.scaled","df.scaled","pvalue.scaled",
    "cfi.scaled","tli.scaled","rmsea.scaled",
    "rmsea.ci.lower.scaled","rmsea.ci.upper.scaled",
    "cfi.robust","tli.robust","rmsea.robust",
    "rmsea.ci.lower.robust","rmsea.ci.upper.robust"
  )
  fit_standard <- available_fit_measures(fit, base_names)
  fit_robust <- if (estimator %in% c("MLR","MLM","MLMV","WLSMV","WLSM","WLSMV")) {
    available_fit_measures(fit, robust_names)
  } else list()

  pe <- parameterEstimates(fit, standardized=TRUE)
  params <- lapply(seq_len(nrow(pe)), function(i) {
    list(
      lhs = pe$lhs[i], op = pe$op[i], rhs = pe$rhs[i],
      est = safe_num(pe$est[i]), se = safe_num(pe$se[i]),
      z = safe_num(pe$z[i]), pvalue = safe_num(pe$pvalue[i]),
      std_all = safe_num(pe$std.all[i])
    )
  })

  # Explicit improper-solution checks
  neg_var <- pe[pe$op=="~~" & pe$lhs==pe$rhs & !is.na(pe$est) & pe$est < 0, , drop=FALSE]
  extreme_loading <- pe[pe$op=="=~" & !is.na(pe$std.all) & abs(pe$std.all) > 1, , drop=FALSE]
  heywood <- nrow(neg_var) > 0 || nrow(extreme_loading) > 0

  mi_list <- list()
  if (converged) {
    mi <- tryCatch(modificationIndices(fit, sort.=TRUE, minimum.value=3.84),
                   error=function(e) NULL)
    if (!is.null(mi)) {
      if (nrow(mi) > 100) mi <- mi[1:100, , drop=FALSE]
      mi_list <- lapply(seq_len(nrow(mi)), function(i) {
        list(lhs=mi$lhs[i], op=mi$op[i], rhs=mi$rhs[i],
             mi=safe_num(mi$mi[i]), epc=safe_num(mi$epc[i]))
      })
    }
  }

  guidance <- c()
  if (!converged) {
    guidance <- c(guidance,
      "ALERTA CRÍTICA: el modelo no convergió. No interprete ni reporte los índices de ajuste o parámetros como resultados definitivos.")
  }
  if (!post_check) {
    guidance <- c(guidance,
      "La verificación posterior de lavaan detectó una solución potencialmente impropia.")
  }
  if (heywood) {
    guidance <- c(guidance,
      "Se detectó un posible caso Heywood (varianza negativa y/o carga estandarizada > |1|). Revise especificación, datos e identificación.")
  }
  if (length(warnings_text)) {
    guidance <- c(guidance,
      "lavaan emitió advertencias durante el ajuste; revíselas antes de interpretar el modelo.")
  }

  # Prefer robust/scaled indices for guidance when available.
  cfi_for_guidance <- fit_robust[["cfi.robust"]] %||%
                      fit_robust[["cfi.scaled"]] %||%
                      fit_standard[["cfi"]]
  rmsea_for_guidance <- fit_robust[["rmsea.robust"]] %||%
                        fit_robust[["rmsea.scaled"]] %||%
                        fit_standard[["rmsea"]]
  srmr_for_guidance <- fit_standard[["srmr"]]

  if (!is.null(cfi_for_guidance)) {
    if (cfi_for_guidance >= .95) guidance <- c(guidance, "CFI muestra ajuste comparativo favorable.")
    else if (cfi_for_guidance >= .90) guidance <- c(guidance, "CFI es aceptable, pero conviene revisar el modelo junto con otros índices.")
    else guidance <- c(guidance, "CFI sugiere ajuste insuficiente; revise especificación y teoría.")
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
    "No modifique el modelo únicamente para mejorar índices de ajuste; conserve sustento teórico.")

  list(
    ok = TRUE,
    estimator = estimator,
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

write(toJSON(result, auto_unbox=TRUE, pretty=TRUE, na="null"), out_file)

%||% <- function(a,b) if (is.null(a)) b else a
args <- commandArgs(trailingOnly=TRUE)
if(length(args)<2) stop("Uso: Rscript advanced_engine.R request.json response.json")
suppressPackageStartupMessages({
  library(jsonlite)
  library(lavaan)
})
req <- fromJSON(args[1], simplifyVector=FALSE)
out <- args[2]

safe <- function(x) ifelse(is.finite(x), as.numeric(x), NA_real_)

capture_fit <- function(expr){
  warnings_text <- character()
  fit <- withCallingHandlers(
    expr,
    warning=function(w){
      warnings_text <<- c(warnings_text, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
  list(fit=fit,warnings_text=unique(warnings_text))
}

result <- tryCatch({
  dat <- read.csv(text=req$csv_text, check.names=FALSE)
  if(ncol(dat)>1 && tolower(names(dat)[1]) %in% c("id","folio","participante","sujeto","caso")) dat <- dat[,-1,drop=FALSE]
  action <- req$action %||% "quality"
  syntax <- req$syntax
  estimator <- toupper(req$estimator %||% "MLR")
  group <- req$group %||% NULL

  ordered_vars <- unlist(req$ordinal_vars %||% list())
  ordered_vars <- intersect(ordered_vars,names(dat))
  if(length(ordered_vars)==0 && identical(req$data_type,"ordinal")) {
    ordered_vars <- setdiff(names(dat), group %||% character())
  }

  fit_one <- function(model, group.equal=NULL){
    cap <- capture_fit(
      sem(model, data=dat, estimator=estimator, std.lv=TRUE,
          ordered=if(length(ordered_vars)) ordered_vars else NULL,
          group=group, group.equal=group.equal,
          missing=if(estimator %in% c("ML","MLR")) "fiml" else "pairwise")
    )
    cap
  }

  if(action=="quality"){
    cap <- fit_one(syntax)
    fit <- cap$fit
    converged <- isTRUE(lavInspect(fit,"converged"))
    post_check <- isTRUE(lavInspect(fit,"post.check"))
    pe <- parameterEstimates(fit, standardized=TRUE)
    load <- pe[pe$op=="=~",c("lhs","rhs","std.all")]
    factors <- unique(load$lhs)
    heywood_factors <- character()

    metrics <- lapply(factors, function(f){
      l <- load$std.all[load$lhs==f]
      if(any(abs(l)>1,na.rm=TRUE)) heywood_factors <<- c(heywood_factors,f)
      theta_raw <- 1-l^2
      theta <- pmax(0,theta_raw)
      cr <- (sum(l,na.rm=TRUE)^2)/((sum(l,na.rm=TRUE)^2)+sum(theta,na.rm=TRUE))
      ave <- sum(l^2,na.rm=TRUE)/(sum(l^2,na.rm=TRUE)+sum(theta,na.rm=TRUE))
      list(factor=f,cr=safe(cr),ave=safe(ave),
           heywood=any(theta_raw<0,na.rm=TRUE) || any(abs(l)>1,na.rm=TRUE))
    })

    observed <- unique(load$rhs)
    use_polychoric <- length(ordered_vars) > 0 && all(observed %in% ordered_vars)
    if(use_polychoric){
      if(!requireNamespace("psych", quietly=TRUE)) stop("Instale el paquete R psych para HTMT policórico.")
      R <- psych::polychoric(dat[,observed,drop=FALSE])$rho
      correlation_type <- "polychoric"
    } else {
      R <- cor(dat[,observed,drop=FALSE], use="pairwise.complete.obs")
      correlation_type <- "pearson"
    }

    ht <- list()
    if(length(factors)>1){
      for(i in 1:(length(factors)-1)) for(j in (i+1):length(factors)){
        ai <- load$rhs[load$lhs==factors[i]]
        bj <- load$rhs[load$lhs==factors[j]]
        hetero <- abs(R[ai,bj,drop=FALSE])
        monoA <- abs(R[ai,ai,drop=FALSE][upper.tri(R[ai,ai,drop=FALSE])])
        monoB <- abs(R[bj,bj,drop=FALSE][upper.tri(R[bj,bj,drop=FALSE])])
        denom <- sqrt(mean(monoA,na.rm=TRUE)*mean(monoB,na.rm=TRUE))
        val <- if(is.finite(denom) && denom>0) mean(hetero,na.rm=TRUE)/denom else NA_real_
        ht[[length(ht)+1]] <- list(
          a=factors[i],b=factors[j],value=safe(val),
          ok=is.finite(val)&&val < (req$htmt_threshold %||% .85)
        )
      }
    }

    guidance <- c(
      "CR ≥ .70 y AVE ≥ .50 suelen considerarse referencias orientativas.",
      paste0("HTMT se calculó con correlaciones ", correlation_type, "."),
      "HTMT debe interpretarse junto con la teoría y el patrón de cargas."
    )
    if(!converged) guidance <- c("ALERTA: el modelo no convergió; no interprete CR/AVE/HTMT como definitivos.",guidance)
    if(!post_check) guidance <- c("lavaan detectó una solución potencialmente impropia.",guidance)
    if(length(heywood_factors)) guidance <- c(
      paste0("Posible Heywood en: ",paste(unique(heywood_factors),collapse=", "),"."),
      guidance
    )

    list(ok=TRUE,title="CR, AVE y HTMT",metrics=metrics,htmt=ht,
         converged=converged,post_check=post_check,
         warnings_text=cap$warnings_text,
         correlation_type=correlation_type,
         heywood_factors=unique(heywood_factors),
         guidance=unique(guidance))

  } else if(action=="polychoric"){
    if(!requireNamespace("psych", quietly=TRUE)) stop("Instale el paquete R psych.")
    vars <- if(length(ordered_vars)) ordered_vars else names(dat)
    pc <- psych::polychoric(dat[,vars,drop=FALSE])$rho
    list(ok=TRUE,title="Matriz de correlaciones policóricas",
         matrix=list(names=colnames(pc), values=unname(split(pc, row(pc)))),
         guidance=c("Las correlaciones policóricas son apropiadas para variables ordinales cuando sus supuestos son razonables."))

  } else if(action %in% c("invariance","multigroup")){
    if(is.null(group) || !nzchar(group) || !(group %in% names(dat))) stop("Indique una variable de grupo válida.")

    caps <- list(
      configural=fit_one(syntax,NULL),
      metric=fit_one(syntax,"loadings"),
      scalar=fit_one(syntax,c("loadings","intercepts")),
      strict=fit_one(syntax,c("loadings","intercepts","residuals"))
    )

    rows <- list(); prev_cfi <- prev_rmsea <- prev_srmr <- NA_real_
    all_warnings <- character()
    all_converged <- TRUE

    for(nm in names(caps)){
      fit <- caps[[nm]]$fit
      conv <- isTRUE(lavInspect(fit,"converged"))
      post <- isTRUE(lavInspect(fit,"post.check"))
      all_converged <- all_converged && conv
      all_warnings <- c(all_warnings,caps[[nm]]$warnings_text)
      fm <- fitMeasures(fit, c("cfi","rmsea","srmr"))
      cfi <- unname(fm["cfi"]); rmsea <- unname(fm["rmsea"]); srmr <- unname(fm["srmr"])
      rows[[length(rows)+1]] <- list(
        model=nm,cfi=safe(cfi),rmsea=safe(rmsea),srmr=safe(srmr),
        converged=conv,post_check=post,
        delta_cfi=if(is.na(prev_cfi)) NA else safe(cfi-prev_cfi),
        delta_rmsea=if(is.na(prev_rmsea)) NA else safe(rmsea-prev_rmsea),
        delta_srmr=if(is.na(prev_srmr)) NA else safe(srmr-prev_srmr)
      )
      prev_cfi <- cfi; prev_rmsea <- rmsea; prev_srmr <- srmr
    }

    guidance <- c(
      "Evalúe cambios en CFI junto con RMSEA, SRMR y justificación sustantiva.",
      "La equivalencia entre grupos no debe decidirse con un único criterio."
    )
    if(!all_converged) guidance <- c("ALERTA: al menos uno de los modelos de invariancia no convergió.",guidance)

    list(ok=TRUE,title=if(action=="multigroup") "Modelo multigrupo / invariancia" else "Invariancia factorial",
         invariance=rows,converged=all_converged,warnings_text=unique(all_warnings),
         guidance=guidance)
  } else stop("Acción avanzada no reconocida.")
}, error=function(e) list(ok=FALSE,error=conditionMessage(e)))

write(toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null"),out)

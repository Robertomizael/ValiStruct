`%||%` <- function(a,b) if (is.null(a)) b else a
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
  if(ncol(dat)>1 && tolower(trimws(names(dat)[1])) %in% c("id","folio","participante","sujeto","caso")) dat <- dat[,-1,drop=FALSE]
  action <- req$action %||% "quality"
  syntax <- req$syntax
  estimator <- toupper(req$estimator %||% "MLR")
  group <- req$group %||% NULL

  ordered_vars <- unlist(req$ordinal_vars %||% list())
  ordered_vars <- intersect(ordered_vars,names(dat))
  if(length(ordered_vars)==0 && (identical(req$data_type,"ordinal") || identical(estimator,"WLSMV"))) {
    model_ov <- tryCatch(lavNames(lavaanify(syntax),"ov.nox"), error=function(e) character())
    ordered_vars <- setdiff(intersect(model_ov,names(dat)),group %||% character())
    if(!length(ordered_vars)) stop("No se identificaron indicadores ordinales del modelo.")
  }
  is_ordinal <- length(ordered_vars)>0

  fit_one <- function(model, group.equal=NULL){
    args <- list(model=model, data=dat, estimator=estimator, std.lv=TRUE,
                 ordered=if(is_ordinal) ordered_vars else NULL,
                 group=group, group.equal=group.equal,
                 missing=if(estimator %in% c("ML","MLR")) "fiml" else "pairwise")
    if(is_ordinal && !is.null(group)) args$parameterization <- "theta"
    capture_fit(do.call("sem",args))
  }
  pick_fit <- function(fit){
    suffix <- if(estimator %in% c("MLR","MLM","MLMV","WLSMV","WLSM","ULSMV")) {
      if(is_ordinal) ".scaled" else ".robust"
    } else ""
    keys <- c(paste0(c("cfi","tli","rmsea"),suffix),"srmr")
    available <- names(fitMeasures(fit))
    if(!all(keys %in% available)) {
      if(suffix==".robust") {
        suffix <- ".scaled"; keys <- c("cfi.scaled","tli.scaled","rmsea.scaled","srmr")
      }
    }
    fm <- fitMeasures(fit,keys)
    list(cfi=unname(fm[1]), tli=unname(fm[2]), rmsea=unname(fm[3]),
         srmr=unname(fm[4]), type=if(suffix=="") "estándar" else substring(suffix,2))
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

    phi <- tryCatch({ p <- lavInspect(fit,"cor.lv"); if(is.list(p)) p[[1]] else p },error=function(e) NULL)
    metrics <- lapply(factors, function(f){
      l <- load$std.all[load$lhs==f]
      if(any(abs(l)>1,na.rm=TRUE)) heywood_factors <<- c(heywood_factors,f)
      theta_raw <- 1-l^2
      theta <- pmax(0,theta_raw)
      cr <- (sum(l,na.rm=TRUE)^2)/((sum(l,na.rm=TRUE)^2)+sum(theta,na.rm=TRUE))
      ave <- sum(l^2,na.rm=TRUE)/(sum(l^2,na.rm=TRUE)+sum(theta,na.rm=TRUE))
      max_r <- NA_real_
      if(!is.null(phi) && f %in% colnames(phi) && ncol(phi)>1)
        max_r <- max(abs(phi[f,setdiff(colnames(phi),f)]),na.rm=TRUE)
      list(factor=f,cr=safe(cr),ave=safe(ave),sqrt_ave=safe(sqrt(ave)),
           max_latent_r=safe(max_r),
           fornell_larcker_ok=if(is.finite(max_r)) sqrt(ave)>max_r else NA,
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

    fl_bad <- vapply(metrics,function(m) isFALSE(m$fornell_larcker_ok),logical(1))
    guidance <- c(
      if(any(fl_bad)) paste0("Fornell-Larcker requiere revisión en: ",
        paste(vapply(metrics[fl_bad],`[[`,"","factor"),collapse=", "),".") else
        "Evalúe Fornell-Larcker junto con HTMT y la teoría.",
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

    list(ok=TRUE,title="CR, AVE, Fornell-Larcker y HTMT",metrics=metrics,htmt=ht,
         latent_correlations=if(!is.null(phi)) list(names=colnames(phi),
           values=unname(split(round(phi,6),row(phi)))) else NULL,
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

    level_int <- if(is_ordinal) "thresholds" else "intercepts"
    caps <- list(
      configural=fit_one(syntax,NULL),
      metric=fit_one(syntax,"loadings"),
      scalar=fit_one(syntax,c("loadings",level_int)),
      strict=fit_one(syntax,c("loadings",level_int,"residuals"))
    )
    rows <- list(); prev <- NULL; prev_fit <- NULL
    all_warnings <- character(); all_converged <- TRUE; fit_type <- NA_character_
    for(nm in names(caps)){
      fit <- caps[[nm]]$fit
      conv <- isTRUE(lavInspect(fit,"converged"))
      post <- isTRUE(lavInspect(fit,"post.check"))
      all_converged <- all_converged && conv
      all_warnings <- c(all_warnings,caps[[nm]]$warnings_text)
      pf <- pick_fit(fit); fit_type <- pf$type
      lrt <- if(!is.null(prev_fit)) tryCatch({
        t <- lavTestLRT(prev_fit,fit)
        list(dchisq=safe(t[2,"Chisq diff"]),ddf=safe(t[2,"Df diff"]),p=safe(t[2,"Pr(>Chisq)"]))
      },error=function(e) list(dchisq=NA_real_,ddf=NA_real_,p=NA_real_)) else
        list(dchisq=NA_real_,ddf=NA_real_,p=NA_real_)
      rows[[length(rows)+1]] <- list(
        model=nm,cfi=safe(pf$cfi),tli=safe(pf$tli),rmsea=safe(pf$rmsea),srmr=safe(pf$srmr),
        converged=conv,post_check=post,
        delta_cfi=if(is.null(prev)) NA else safe(pf$cfi-prev$cfi),
        delta_rmsea=if(is.null(prev)) NA else safe(pf$rmsea-prev$rmsea),
        delta_srmr=if(is.null(prev)) NA else safe(pf$srmr-prev$srmr),
        delta_chisq=lrt$dchisq,delta_df=lrt$ddf,delta_p=lrt$p
      )
      prev <- pf; prev_fit <- fit
    }
    guidance <- c(
      paste0("Índices de ajuste: versión ",fit_type,"; estimador ",estimator,"."),
      if(is_ordinal) "Para indicadores ordinales se restringieron umbrales y se utilizó parametrización theta; verifique la identificación de cada comparación." else "Para indicadores continuos se restringieron interceptos.",
      "Interprete ΔCFI, ΔRMSEA, ΔSRMR y la prueba de diferencia de χ² en conjunto con teoría y tamaño muestral.",
      "La equivalencia entre grupos no debe decidirse con un único criterio."
    )
    if(!all_converged) guidance <- c("ALERTA: al menos un modelo de invariancia no convergió.",guidance)
    list(ok=TRUE,title=if(action=="multigroup") "Modelo multigrupo / invariancia" else "Invariancia factorial",
         invariance=rows,fit_type=fit_type,converged=all_converged,
         warnings_text=unique(all_warnings),guidance=guidance)
  } else stop("Acción avanzada no reconocida.")
}, error=function(e) list(ok=FALSE,error=conditionMessage(e)))

write(toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null"),out)

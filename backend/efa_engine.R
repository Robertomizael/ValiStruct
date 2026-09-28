#!/usr/bin/env Rscript
# ValiStruct v5.2 AFE: real common-factor extraction and independent diagnostics.
# Do not source lavaan_engine.R: it is a command-line program with side effects.
args <- commandArgs(trailingOnly=TRUE)
if(length(args)!=2L) stop("Uso: Rscript efa_engine.R entrada.json salida.json")
suppressPackageStartupMessages({library(jsonlite); library(psych)})
`%||%` <- function(a,b) if(is.null(a) || length(a)==0L) b else a
req <- jsonlite::fromJSON(args[1],simplifyVector=FALSE)
out <- args[2]
safe <- function(v) if(length(v)==1L && is.finite(v)) unname(as.numeric(v)) else NULL
matrix_json <- function(x) lapply(seq_len(nrow(x)),function(i) unname(as.numeric(x[i,])))
diagnostics_mardia <- function(x) {
  n <- nrow(x); p <- ncol(x)
  if(n<8L || n<=p || n>2000L) return(list(ok=FALSE,reason="Mardia requiere 8 o más casos, n > p; el diagnóstico se limita a n <= 2000 por memoria."))
  z <- scale(x,center=TRUE,scale=FALSE)
  S <- crossprod(z)/n
  inv <- tryCatch(solve(S),error=function(e) NULL)
  if(is.null(inv)) return(list(ok=FALSE,reason="Matriz singular: Mardia no calculable."))
  a <- z %*% inv %*% t(z)
  b1p <- sum(a^3)/(n*n); chi <- n*b1p/6
  df <- p*(p+1)*(p+2)/6
  b2p <- mean(diag(a)^2); ez <- p*(p+2)
  zval <- (b2p-ez)/sqrt(8*p*(p+2)/n)
  list(ok=TRUE,n=n,p=p,skewness=list(b1p=safe(b1p),statistic=safe(chi),df=safe(df),
    pvalue=safe(pchisq(chi,df,lower.tail=FALSE))),
    kurtosis=list(b2p=safe(b2p),expected=safe(ez),z=safe(zval),
      pvalue=safe(2*pnorm(abs(zval),lower.tail=FALSE))))
}
output <- tryCatch({
  dat <- read.csv(text=req$csv_text,check.names=FALSE,stringsAsFactors=FALSE,
    na.strings=c("","NA","N/A","NULL","."))
  if(!nrow(dat) || !ncol(dat)) stop("Archivo de datos vacío.")
  if(tolower(names(dat)[1]) %in% c("id","folio","participante","sujeto","caso")) dat <- dat[-1]
  cols <- unlist(req$item_names %||% names(dat),use.names=FALSE)
  if(length(cols)<3L || anyDuplicated(cols)>0L || any(!cols %in% names(dat)))
    stop("Indique al menos tres ítems válidos y sin duplicados.")
  d <- dat[,cols,drop=FALSE]
  for(i in seq_along(d)) {
    val <- suppressWarnings(as.numeric(as.character(d[[i]])))
    bad <- !is.na(d[[i]]) & !is.finite(val)
    if(any(bad)) stop(paste("Datos no numéricos en",names(d)[i]))
    d[[i]] <- val
  }
  n_initial <- nrow(d)
  d <- d[complete.cases(d),,drop=FALSE]
  n <- nrow(d); p <- ncol(d)
  if(n<max(15,p+2)) stop("AFE requiere al menos max(15, p+2) casos completos.")
  if(any(vapply(d,function(v) sd(v)==0,logical(1)))) stop("Elimine ítems sin variabilidad.")
  x <- as.matrix(d); R <- cor(x)
  if(any(!is.finite(R)) || is.null(tryCatch(solve(R),error=function(e) NULL)))
    stop("Matriz de correlaciones singular; revise colinealidad y variables redundantes.")
  kmo <- psych::KMO(R)
  bart <- psych::cortest.bartlett(R,n=n)
  mardia <- diagnostics_mardia(x)
  requested_method <- tolower(req$method %||% "pa")
  requested_rotation <- tolower(req$rotation %||% "oblimin")
  method_map <- c(uls="minres",gls="gls",ml="ml",pa="pa",alpha="alpha",minres="minres")
  rotation_map <- c(none="none",varimax="varimax",quartimax="quartimax",
    equamax="equamax",oblimin="oblimin",promax="promax")
  if(!requested_rotation %in% names(rotation_map)) stop("Rotación no compatible con motor R.")
  if(!requested_method %in% c(names(method_map),"diagnostics")) stop("Extracción no implementada; no se sustituye silenciosamente.")
  result <- list(ok=TRUE,engine="R psych",package_version=as.character(packageVersion("psych")),
    method=requested_method,rotation=requested_rotation,
    n_original=n_initial,n_complete=n,n_excluded=n_initial-n,
    item_names=cols,kmo=list(overall=safe(kmo$MSA),per_item=as.list(as.numeric(kmo$MSAi))),
    bartlett=list(chi2=safe(bart$chisq),df=safe(bart$df),p=safe(bart$p.value)),
    mardia=mardia,correlation=matrix_json(R),eigenvalues=unname(as.numeric(eigen(R,symmetric=TRUE)$values)))
  if(requested_method!="diagnostics") {
    nf <- as.integer(req$factors %||% 2)
    if(!is.finite(nf) || nf<1L || nf>=p) stop("Número de factores: elija entre 1 y p-1.")
    estimate <- suppressWarnings(psych::fa(x,nfactors=nf,fm=unname(method_map[requested_method]),
      rotate=unname(rotation_map[requested_rotation]),scores="none",warnings=TRUE))
    P <- unclass(estimate$loadings)
    if(length(dim(P))!=2L || nrow(P)!=p || any(!is.finite(P)))
      stop("El motor R no produjo una matriz válida de cargas.")
    Phi <- estimate$Phi
    if(is.null(Phi)) Phi <- diag(nf)
    structure <- P %*% Phi
    comm <- rowSums(P*structure)
    parallel_n <- max(20L,min(200L,as.integer(req$parallel_runs %||% 100L)))
    set.seed(20260927L) # exact reproducibility
    pa <- suppressWarnings(psych::fa.parallel(x,fm="minres",fa="fa",
      n.iter=parallel_n,plot=FALSE,error.bars=FALSE))
    result$factors <- nf
    result$loadings <- matrix_json(P)
    result$structure <- matrix_json(structure)
    result$phi <- matrix_json(Phi)
    result$communalities <- unname(as.numeric(comm))
    result$parallel_runs <- parallel_n
    result$parallel_eigenvalues <- unname(as.numeric(pa$fa.sim))
    result$parallel_recommended <- as.integer(pa$nfact)
    result$factor_correlations <- matrix_json(Phi)
    result$fit <- list(rms=safe(estimate$rms),dof=safe(estimate$dof),
      chisq=safe(estimate$STATISTIC),p=safe(estimate$PVAL),rmsea=safe(estimate$RMSEA[1]))
    result$warnings <- character()
  }
  result
},error=function(e) list(ok=FALSE,error=conditionMessage(e)))
jsonlite::write_json(output,out,auto_unbox=TRUE,null="null",digits=12,pretty=TRUE)

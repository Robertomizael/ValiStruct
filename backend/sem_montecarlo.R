`%||%` <- function(a,b) if (is.null(a)) b else a
args <- commandArgs(trailingOnly=TRUE)
if(length(args)<2) stop("Uso: Rscript sem_montecarlo.R request.json response.json")
suppressPackageStartupMessages({
  library(jsonlite)
  library(lavaan)
})
req <- fromJSON(args[1], simplifyVector=FALSE)
out <- args[2]

res <- tryCatch({
  pop <- req$population_model
  ana <- req$analysis_model
  n <- as.integer(req$n %||% 300)
  reps <- as.integer(req$reps %||% 500)
  alpha <- as.numeric(req$alpha %||% .05)
  seed <- as.integer(req$seed %||% 2026)

  if(!is.finite(n) || n < 20 || n > 100000) stop("n debe estar entre 20 y 100000.")
  if(!is.finite(reps) || reps < 10 || reps > 5000) stop("reps debe estar entre 10 y 5000.")
  if(!is.finite(alpha) || alpha <= 0 || alpha >= 1) stop("alpha debe estar entre 0 y 1.")
  set.seed(seed)

  pop_fit <- lavaanify(pop, auto=TRUE, model.type="sem", fixed.x=FALSE)
  pop_labels <- pop_fit$label
  pop_vals <- pop_fit$ustart
  # RC5: bias matching only uses explicit labels shared across population and analysis models.
  labeled <- nzchar(pop_labels)
  pop_vals_labeled <- pop_vals[labeled]
  names(pop_vals_labeled) <- pop_labels[labeled]

  estimates <- list()
  converged <- 0L

  for(i in seq_len(reps)){
    dat <- simulateData(pop, sample.nobs=n, model.type="sem")
    fit <- try(sem(ana, data=dat, std.lv=TRUE, meanstructure=TRUE), silent=TRUE)
    if(inherits(fit,"try-error")) next
    if(!lavInspect(fit,"converged")) next
    converged <- converged + 1L
    pe <- parameterEstimates(fit, standardized=TRUE)
    key <- paste(pe$lhs,pe$op,pe$rhs,sep=" ")
    for(j in seq_len(nrow(pe))){
      if(pe$op[j] %in% c("=~","~","~~") && pe$lhs[j] != pe$rhs[j]){
        k <- if(nzchar(pe$label[j])) pe$label[j] else paste0("unlabeled::",key[j])
        if(is.null(estimates[[k]])) estimates[[k]] <- list(est=numeric(),p=numeric(),std=numeric(),
                                                          explicit_label=nzchar(pe$label[j]))
        estimates[[k]]$est <- c(estimates[[k]]$est, pe$est[j])
        estimates[[k]]$p <- c(estimates[[k]]$p, pe$pvalue[j])
        estimates[[k]]$std <- c(estimates[[k]]$std, pe$std.all[j])
      }
    }
  }

  pars <- lapply(names(estimates), function(k){
    e <- estimates[[k]]
    popval <- NA_real_
    explicit_label <- isTRUE(estimates[[k]]$explicit_label)
    if(explicit_label && k %in% names(pop_vals_labeled)) popval <- as.numeric(pop_vals_labeled[k])
    mean_est <- mean(e$est,na.rm=TRUE)
    bias <- if(is.finite(popval)) mean_est-popval else NA_real_
    sig_rate <- mean(e$p < alpha,na.rm=TRUE)
    metric_name <- if(is.finite(popval) && abs(popval) < .Machine$double.eps^0.5) "type_i_error" else "power"
    list(
      label=k,population=popval,mean_estimate=mean_est,bias=bias,
      significance_rate=sig_rate,metric=metric_name,
      power=if(metric_name=="power") sig_rate else NA_real_,
      type_i_error=if(metric_name=="type_i_error") sig_rate else NA_real_,
      n_valid=length(e$est),
      population_matched=is.finite(popval),
      explicit_label=explicit_label
    )
  })

  list(
    ok=TRUE,n=n,requested_reps=reps,valid_reps=converged,
    convergence_rate=converged/reps,parameters=pars,
    guidance=c(
      "RC5 calcula sesgo únicamente cuando el parámetro tiene una etiqueta explícita compartida entre el modelo poblacional y el modelo de análisis.",
      "Cuando el valor poblacional es 0, la tasa p<alpha se reporta como error Tipo I; en parámetros no nulos se interpreta como poder."
    )
  )
}, error=function(e) list(ok=FALSE,error=conditionMessage(e)))

write(toJSON(res,auto_unbox=TRUE,pretty=TRUE,na="null"),out)

%||% <- function(a,b) if (is.null(a)) b else a
args <- commandArgs(trailingOnly=TRUE)
if(length(args)<2) stop("Uso: Rscript model_check.R request.json response.json")
suppressPackageStartupMessages({
  library(jsonlite)
  library(lavaan)
})
req <- fromJSON(args[1], simplifyVector=FALSE)
out <- args[2]

result <- tryCatch({
  syn <- req$syntax
  vars <- unlist(req$variables %||% list())
  issues <- list()

  pt <- try(lavaanify(syn, auto=TRUE, model.type="sem", fixed.x=FALSE), silent=TRUE)
  if(inherits(pt,"try-error")) stop(as.character(pt))

  obs <- unique(c(pt$lhs[pt$op %in% c("=~","~","~~")], pt$rhs[pt$op %in% c("=~","~","~~")]))
  latent <- unique(pt$lhs[pt$op=="=~"])
  observed <- setdiff(obs, latent)

  if(length(vars)){
    missing_vars <- setdiff(observed, vars)
    if(length(missing_vars)){
      for(v in missing_vars) issues[[length(issues)+1]] <- list(level="warn",text=paste("Variable del modelo no encontrada en la lista disponible:",v))
    }
  }

  for(f in latent){
    inds <- pt$rhs[pt$op=="=~" & pt$lhs==f]
    if(length(inds)<2) issues[[length(issues)+1]] <- list(level="error",text=paste("Factor",f,"con menos de 2 indicadores."))
    if(length(inds)==2) issues[[length(issues)+1]] <- list(level="warn",text=paste("Factor",f,"con 2 indicadores: revise restricciones e identificación."))
  }

  duplicated_rows <- duplicated(paste(pt$lhs,pt$op,pt$rhs))
  if(any(duplicated_rows)){
    for(k in unique(paste(pt$lhs[duplicated_rows],pt$op[duplicated_rows],pt$rhs[duplicated_rows]))){
      issues[[length(issues)+1]] <- list(level="warn",text=paste("Relación duplicada o repetida:",k))
    }
  }

  # approximate df based on covariance structure
  p <- length(observed)
  n_moments <- p*(p+1)/2
  free <- sum(pt$free > 0)
  approx_df <- n_moments - free
  if(approx_df < 0) issues[[length(issues)+1]] <- list(level="error",text=paste("Modelo posiblemente subidentificado: gl aproximados =",approx_df))
  else if(approx_df == 0) issues[[length(issues)+1]] <- list(level="warn",text="Modelo aproximadamente just-identificado (gl≈0); el ajuste global no puede evaluarse de forma informativa.")
  else issues[[length(issues)+1]] <- list(level="ok",text=paste("Grados de libertad aproximados positivos:",approx_df))

  if(!length(issues)) issues[[1]] <- list(level="ok",text="lavaan pudo interpretar la sintaxis sin advertencias básicas.")

  list(ok=TRUE,issues=issues,observed=observed,latent=latent,free_parameters=free,approx_df=approx_df)
}, error=function(e) list(ok=FALSE,error=conditionMessage(e)))

write(toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null"),out)

`%||%` <- function(a,b) if (is.null(a)) b else a
args <- commandArgs(trailingOnly=TRUE)
if(length(args)<2) stop("Uso: Rscript missingness_engine.R request.json response.json")
suppressPackageStartupMessages(library(jsonlite))
req <- fromJSON(args[1], simplifyVector=FALSE)
out <- args[2]

result <- tryCatch({
  dat <- read.csv(text=req$csv_text, check.names=FALSE, na.strings=c("","NA","NaN","."))
  if(ncol(dat)>1 && tolower(names(dat)[1]) %in% c("id","folio","participante","sujeto","caso")) dat <- dat[,-1,drop=FALSE]

  # Keep variables with at least one observed numeric value
  keep <- sapply(dat, function(x) is.numeric(x) && any(!is.na(x)))
  dat <- dat[,keep,drop=FALSE]
  if(ncol(dat)<2) stop("Se requieren al menos dos variables numéricas.")

  if(!requireNamespace("naniar", quietly=TRUE)) stop("Instale el paquete R naniar.")
  test <- naniar::mcar_test(dat)

  patterns <- length(unique(apply(is.na(dat),1,paste0,collapse="")))
  stat <- as.numeric(test$statistic[1])
  df <- as.numeric(test$df[1])
  p <- as.numeric(test$p.value[1])

  interpretation <- if(is.finite(p) && p >= .05) {
    "La prueba no fue significativa; los datos son compatibles con el supuesto MCAR. Este resultado no prueba MCAR de manera definitiva."
  } else {
    "La prueba fue significativa; existe evidencia contra MCAR. Considere MAR/MNAR y evite decisiones automáticas basadas en eliminación por lista."
  }

  list(
    ok=TRUE,
    statistic=stat,
    df=df,
    p_value=p,
    patterns=patterns,
    n=nrow(dat),
    variables=ncol(dat),
    interpretation=interpretation
  )
}, error=function(e) list(ok=FALSE,error=conditionMessage(e)))

write(toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null"),out)

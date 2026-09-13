suppressPackageStartupMessages({
  library(jsonlite)
  library(lavaan)
})

args_all <- commandArgs(trailingOnly=FALSE)
file_arg <- sub("^--file=","",args_all[grep("^--file=",args_all)])
if(!length(file_arg)) stop("No se pudo determinar la ruta del script.")
root <- normalizePath(file.path(dirname(file_arg), ".."))
engine <- file.path(root,"backend","lavaan_engine.R")
tmp <- tempdir()

run_engine <- function(request, stem){
  req_file <- file.path(tmp,paste0(stem,"_request.json"))
  out_file <- file.path(tmp,paste0(stem,"_response.json"))
  write(toJSON(request,auto_unbox=TRUE),req_file)
  status <- system2("Rscript",c(engine,req_file,out_file))
  if(status != 0) stop(paste("ValiStruct engine failed:",stem))
  ans <- fromJSON(out_file,simplifyVector=FALSE)
  if(!isTRUE(ans$ok)) stop(ans$error)
  ans
}

check_close <- function(got, expected, tol=1e-8){
  if(is.null(got) || length(got)==0 || is.na(expected)) return(NULL)
  list(
    got=as.numeric(got),
    expected=as.numeric(expected),
    abs_diff=abs(as.numeric(got)-as.numeric(expected)),
    pass=abs(as.numeric(got)-as.numeric(expected)) <= tol
  )
}

# --------------------------------------------------
# Scenario 1: continuous CFA with MLR
# --------------------------------------------------
set.seed(20260912)
population1 <- '
  F1 =~ 0.80*i1 + 0.75*i2 + 0.70*i3 + 0.85*i4
  F2 =~ 0.78*i5 + 0.72*i6 + 0.81*i7 + 0.74*i8
  F1 ~~ 0.45*F2
'
dat1 <- simulateData(population1, sample.nobs=600, model.type="cfa")
model1 <- '
  F1 =~ i1 + i2 + i3 + i4
  F2 =~ i5 + i6 + i7 + i8
'
csv1 <- paste(capture.output(write.csv(dat1,row.names=FALSE)),collapse="\n")
req1 <- list(
  csv_text=csv1,syntax=model1,estimator="MLR",
  data_type="continuous",missing="fiml",bootstrap=0,
  ordinal_vars=list()
)
vs1 <- run_engine(req1,"continuous_mlr")
if(!isTRUE(vs1$converged)) stop("Continuous MLR model did not converge in ValiStruct.")

ref1 <- sem(model1,data=dat1,estimator="MLR",missing="fiml",std.lv=TRUE,meanstructure=TRUE)
if(!lavInspect(ref1,"converged")) stop("Reference continuous MLR model did not converge.")

ref1_all <- fitMeasures(ref1)
checks1 <- list()
for(nm in c("cfi","tli","rmsea","srmr","cfi.robust","tli.robust","rmsea.robust")){
  expected <- if(nm %in% names(ref1_all)) ref1_all[[nm]] else NA_real_
  got <- if(nm %in% names(vs1$fit)) vs1$fit[[nm]] else vs1$fit_robust[[nm]]
  ck <- check_close(got,expected)
  if(!is.null(ck)) checks1[[nm]] <- ck
}

# Compare standardized loadings
ref1_pe <- parameterEstimates(ref1,standardized=TRUE)
ref1_load <- ref1_pe[ref1_pe$op=="=~",]
load_checks1 <- list()
for(p in vs1$parameters){
  if(identical(p$op,"=~")){
    row <- ref1_load[ref1_load$lhs==p$lhs & ref1_load$rhs==p$rhs,]
    if(nrow(row)==1){
      load_checks1[[paste(p$lhs,p$rhs,sep="=~")]] <- check_close(p$std_all,row$std.all[[1]])
    }
  }
}

# --------------------------------------------------
# Scenario 2: ordinal CFA with WLSMV
# --------------------------------------------------
set.seed(20260913)
latent <- simulateData(population1, sample.nobs=800, model.type="cfa")
cuts <- c(-Inf,-1,-0.3,0.3,1,Inf)
ord <- as.data.frame(lapply(latent,function(x) as.ordered(cut(x,breaks=cuts,labels=FALSE))))
names(ord) <- names(latent)

csv2 <- paste(capture.output(write.csv(data.frame(lapply(ord,as.integer)),row.names=FALSE)),collapse="\n")
ordinal_names <- names(ord)
req2 <- list(
  csv_text=csv2,syntax=model1,estimator="WLSMV",
  data_type="ordinal",missing="pairwise",bootstrap=0,
  ordinal_vars=as.list(ordinal_names)
)
vs2 <- run_engine(req2,"ordinal_wlsmv")
if(!isTRUE(vs2$converged)) stop("Ordinal WLSMV model did not converge in ValiStruct.")

ord_numeric <- data.frame(lapply(ord,as.integer))
ref2 <- sem(model1,data=ord_numeric,estimator="WLSMV",ordered=ordinal_names,
            missing="pairwise",std.lv=TRUE,meanstructure=TRUE)
if(!lavInspect(ref2,"converged")) stop("Reference ordinal WLSMV model did not converge.")

ref2_all <- fitMeasures(ref2)
checks2 <- list()
for(nm in c("cfi","tli","rmsea","srmr","cfi.scaled","tli.scaled","rmsea.scaled",
            "cfi.robust","tli.robust","rmsea.robust")){
  expected <- if(nm %in% names(ref2_all)) ref2_all[[nm]] else NA_real_
  got <- if(nm %in% names(vs2$fit)) vs2$fit[[nm]] else vs2$fit_robust[[nm]]
  ck <- check_close(got,expected)
  if(!is.null(ck)) checks2[[nm]] <- ck
}

all_checks <- c(checks1,load_checks1,checks2)
all_pass <- length(all_checks)>0 && all(vapply(all_checks,function(x)isTRUE(x$pass),logical(1)))

out <- list(
  ok=all_pass,
  continuous_mlr=list(
    converged=vs1$converged,
    post_check=vs1$post_check,
    checks=checks1,
    standardized_loadings=load_checks1
  ),
  ordinal_wlsmv=list(
    converged=vs2$converged,
    post_check=vs2$post_check,
    checks=checks2
  )
)

cat(toJSON(out,auto_unbox=TRUE,pretty=TRUE))
if(!all_pass) quit(status=1)

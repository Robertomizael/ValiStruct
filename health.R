suppressPackageStartupMessages({
  library(jsonlite)
  library(lavaan)
})
x <- list(
  ok=TRUE,
  r_version=R.version.string,
  lavaan_version=as.character(packageVersion("lavaan"))
)
cat(toJSON(x, auto_unbox=TRUE))

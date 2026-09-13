# semTools se conserva para validación/invariancia avanzada prevista en la beta.
packages <- c("lavaan","semTools","psych","jsonlite","naniar")
to_install <- packages[!sapply(packages, requireNamespace, quietly=TRUE)]
if (length(to_install)) install.packages(to_install, repos="https://cloud.r-project.org")
cat("Paquetes instalados/verificados:\n")
cat(paste(packages, collapse=", "), "\n")

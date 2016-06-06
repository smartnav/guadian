#                               I think: puts it all on one line?
(test -a ~/.pam_environment && (sed 's/#.*//' ~/.pam_environment | tr '\n' ' ')) || echo "PAM_ENV_FOUND=FALSE"

#!bin/bash
#
# Step 1: Use rsync to copy from source to api
rsync -av --delete ./src/ ../api/src/shared/

# Step 2: Use rsync again to copy from source to front
rsync -av --delete ./src/ ../agora/src/shared/

# Step 3: Apply sed to every file synced in front. Validator is not imported the same way in the browser.
# See https://github.com/validatorjs/validator.js
# Step 4: add "generated" comment if it does not already exist
comment="/** **** WARNING: GENERATED FROM SHARED DIRECTORY, DO NOT MOFIFY THIS FILE DIRECTLY! **** **/"
find ../agora/src/shared/ -name "*.ts" -print0 | while read -d $'\0' file
do
  sed -i '/import validator from "validator";/d' $file
  # Check if the comment already exists in the file
  if ! grep -qF "$comment" "$file"; then
      # If the comment doesn't exist, add it using sed
      sed -i "1i $comment" "$file"
  fi
done

find ../api/src/shared/ -name "*.ts" -print0 | while read -d $'\0' file
do
  # Check if the comment already exists in the file
  if ! grep -qF "$comment" "$file"; then
      # If the comment doesn't exist, add it using sed
      sed -i "1i $comment" "$file"
  fi
done

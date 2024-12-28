#!/bin/bash

set -e

# load .env file
export $(grep -v '^#' .env | xargs)

REMOTEPATH=""
# echo "REMOTEPATH: $REMOTEPATH"

LOCALPATH='./out'

#add as many as you want, this will prevent matching files from being removed from / overwritten / copied to the other side.
EXCLUDES='--exclude-glob .git --exclude-glob .DS_Store'

#careful with this, it will delete all locally non-existing files, which might still be used by clients which have cached an older version.
# DELETE='' #don't delete anything, just overwrite or add.
DELETE='--delete' #deletes ANYTHING on the remote that isn't in the local, other than the EXCLUDES.

# Actual FTP upload
lftp -f "
set ftp:ssl-force true;
set ftp:ssl-protect-data false; # TODO: This seems to slow down lftp deploy considarbly?
set ftp:use-utf8 true;
set file:charset UTF-8;
set ftp:charset UTF-8;
set sftp:charset UTF-8;
set ftp:list-options -a;
set mirror:parallel-directories true;
open $FTPHOST;
user $FTPUSER $FTPPASS;
lcd $LOCALPATH;
cd $REMOTEPATH;
mirror --reverse $DELETE --scan-all-first --depth-first --use-cache --verbose --no-umask --transfer-all --parallel=4 $EXCLUDES
bye
"

#!/bin/sh

# This script must be executed in the repo where
# the *.ts files are.
# It will concatenate the segments into one temp
# file which ffmpeg will reencode the audio track.
# By default the ouptup filename is output.mp4
# but can be changed by providing the name as parameter.
#
# ffmpeg is required
#
# Example:
# $ ./m3u8-concat.sh trololo.mp4


# Get the output file name
output=$1
if [ -z "$output" ]; then
  output="output.mp4"
fi

# Get length of segment in the current repo
seglen=`ls -la segment-*.ts | wc -l`
if [ -z "$seglen" ]; then
  echo "Not segment file found"
  exit 1
fi

# Clean temp files
bin=`rm -f all.ts`

# Concat segments into one
a=1
while [ "$a" -le $seglen ]
do
  bin=`cat segment-$a.ts >> all.ts`
  a=`expr $a + 1`
done

# Run ffmpeg to reencode the audio
bin=`ffmpeg -i all.ts -bsf:a aac_adtstoasc -vcodec copy $output`
echo $bin

# Delete temp files
bin=`rm -f all.ts`
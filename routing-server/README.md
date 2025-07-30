mkdir brouter

cd brouter

git clone https://github.com/abrensch/brouter.git

docker build -t brouter .

cd ..

Download E5_N45.rd5 (Switzerland) under the brouter index http://brouter.de/brouter/segments4 and place it in the segment folder.

docker run --rm \
  -v ./segments:/segments4 \
  -p 17777:17777 \
  --name brouter \
  brouter
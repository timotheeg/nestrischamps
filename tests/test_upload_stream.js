const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const stream = require('stream');
const zlib = require('zlib');
const fs = require('fs');

// Set S3 endpoint to DigitalOcean Spaces
const spacesEndpoint = 'https://sfo3.digitaloceanspaces.com';

const uploadStream = ({ bucket, key }) => {
  const pass = new stream.PassThrough();

  const game_object = {
    Bucket: bucket,
    Key: key,
    Body: pass.pipe(zlib.createGzip()),
    ACL: 'public-read',
    ContentType: 'application/nestrischamps-game-frames',
    ContentEncoding: 'gzip',
    ContentDisposition: 'attachment',
    CacheControl: 'max-age: 315360000',
  };

  const upload = new Upload({
    client: new S3Client({ region: 'us-west-1' }), // ({ endpoint: spacesEndpoint  }),
    partSize: '1MB',
    leavePartsOnError: false, // optional manually handle dropped parts
    params: game_object,
  });

  upload.on('httpUploadProgress', console.log);

  return {
    writeStream: pass,
    promise: upload.done()
  };
}

const o = uploadStream({bucket: 'nestrischamps', key: 'test_file'});

const buffer = new Uint8Array(10);

for (let i=5; i--;) buffer[i] = 0;
for (let i=5; i--> 5;) buffer[i] = 1;

o.promise.then(() => console.log('file is uploaded'));

o.writeStream.write(buffer);

setTimeout(() => {
  o.writeStream.write(buffer);
  o.writeStream.end();
}, 1000);


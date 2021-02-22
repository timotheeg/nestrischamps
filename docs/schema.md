OCR frames are sent in binary format with the following fields:

* header:        uint8 version, type of frame (1:classic, 2:das_trainer), player num
* gameid:        uint16
* ctime:         uint32 (is that much really needed?)
* score:         uint24 (max score ~1.6M) (basically uint8[3])
* level:         uint8
* lines:         unit16
* preview:       uint8 (4LSB + cur_piece in 4MSB)
* t:             uint8
* j:             uint8
* z:             uint8
* o:             uint8
* s:             uint8
* l:             uint8
* i:             uint8
* instant_das:   uint8
* cur_piece_das: uint8
* field:         unit8[50]


Frame size: 74 bytes

for preview and cur_piece:
1: T
2: J
3: Z
4: O
5: S
6: L
7: I

das values go from 0 to 16, so that's 17 distinct values, and so sadly, we cannot cram them both into a single byte :(

header byte can be divided as such:
* version: 3 bits (allow for 255 version upgrades of the schema)
* types of game: 2 bits (currently only 2: classic:1, das_trainer:2)
* player number: 3 bits (allow a 8 player display, so far layouts are just 2 players)

ctime will NOT be a timestamp, it will represent a number of milliseconds elapsed since player started to play.
e.g. now() - start_time
By using a 32 bit int, we allow for


Notes: Some values, could be bundled into fewer bytes. For example:
* lines: 9 bits
* instant das: 5 bits
* cur piece das: 5 bits
* level: 6 bits
* preview: 3 bits
* cur piece: 3 bits

current total for the above: 6 bytes

Actually needed in total: 31 bits: 4 bytes (!)

OCR frames are sent in binary format with the following fields:

* header:        uint8 type of frame (1:classic, 2:das_trainer)
* gameid:        uint16
* gametime:      uint32
* score:         uint32 (max score ~1.6M)
* level:         uint8
* lines:         unit16
* field:         unit8[50]
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


Frame size: 73 bytes

for preview and cur_piece:
1: T
2: J
3: Z
4: O
5: S
6: L
7: I

das value can go from 0 to 16, so that's 17 distinct values, sadly, we cannot cram them both into a single byte

OCR frames are sent in binary format with the following fields:

* header:        uint8 type of frame (1:classic, 2:das_trainer)
* gameid:        uint16
* gametime:      uint32
* score:         uint32 (max score ~1.6M)
* level:         uint8
* lines:         unit16
* field:         unit16[25]
* preview:       uint8
* t:             uint8
* j:             uint8
* z:             uint8
* o:             uint8
* s:             uint8
* l:             uint8
* i:             uint8
* instant_das:   uint8
* cur_piece_das: uint8
* cur_piece:     uint8


Frame size: 72

for preview and cur_piece:
1: T
2: J
3: Z
4: O
5: S
6: L
7: I

Can possibly merge preview and cur_piece in a single 8 bytes representation (4 first bits, 4 last bits)


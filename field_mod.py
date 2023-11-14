"""
Example of modification that needs to be done to playfield in order for proper rendering
"""

BLANK_TILE = 0xEF

PIECE_ORIENTATION_TO_TILE_ID = [
    0x7B,
    0x7B,
    0x7B,
    0x7B,
    0x7D,
    0x7D,
    0x7D,
    0x7D,
    0x7C,
    0x7C,
    0x7B,
    0x7D,
    0x7D,
    0x7C,
    0x7C,
    0x7C,
    0x7C,
    0x7B,
    0x7B,
]


ORIENTATION_TABLE = [
    [(-1, 0), (0, 0), (1, 0), (0, -1)],  # T up
    [(0, -1), (0, 0), (1, 0), (0, 1)],  # T right
    [(-1, 0), (0, 0), (1, 0), (0, 1)],  # T down (spawn)
    [(0, -1), (-1, 0), (0, 0), (0, 1)],  # T left
    [(0, -1), (0, 0), (-1, 1), (0, 1)],  # J left
    [(-1, -1), (-1, 0), (0, 0), (1, 0)],  # J up
    [(0, -1), (1, -1), (0, 0), (0, 1)],  # J right
    [(-1, 0), (0, 0), (1, 0), (1, 1)],  # J down (spawn)
    [(-1, 0), (0, 0), (0, 1), (1, 1)],  # Z horizontal (spawn)
    [(1, -1), (0, 0), (1, 0), (0, 1)],  # Z vertical
    [(-1, 0), (0, 0), (-1, 1), (0, 1)],  # O (spawn)
    [(0, 0), (1, 0), (-1, 1), (0, 1)],  # S horizontal (spawn)
    [(0, -1), (0, 0), (1, 0), (1, 1)],  # S vertical
    [(0, -1), (0, 0), (0, 1), (1, 1)],  # L right
    [(-1, 0), (0, 0), (1, 0), (-1, 1)],  # L down (spawn)
    [(-1, -1), (0, -1), (0, 0), (0, 1)],  # L left
    [(1, -1), (-1, 0), (0, 0), (1, 0)],  # L up
    [(0, -2), (0, -1), (0, 0), (0, 1)],  # I vertical
    [(-2, 0), (-1, 0), (0, 0), (1, 0)],  # I horizontal (spawn)
]


def overlay_piece(
    playfield: bytearray,
    tetrimino_x: int,
    tetrimino_y: int,
    orientation_id,
):
    if orientation_id > 0x12:
        # During the playstates 1 & 8 this should always be a valid orientation id.  This is a safeguard.
        return playfield

    for (x_offset, y_offset) in ORIENTATION_TABLE[orientation_id]:
        index = (tetrimino_y + y_offset) * 10 + tetrimino_x + x_offset
        if index >= 0 and index < 200:
            playfield[index] = PIECE_ORIENTATION_TO_TILE_ID[orientation_id]
    return playfield


def overlay_lineclear(
    playfield: bytearray,
    row_y: int,
    completed_rows: list[int],
    frame_counter: int,
):
    """
    example:

    16: XXXXXXXXXX
    17: XXXXXXXXXX
    18: XXX XX XXX
    19: XXXXXXXXXX

    completed_rows: [16,17,0,19]

    0 is used to signify no clear.  It's why top line clear doesn't have animation.


    (frame_counter & 3 == 0) and row_y == 0

    16: XXXX  XXXX
    17: XXXX  XXXX
    18: XXX XX XXX
    19: XXXX  XXXX

    (frame_counter & 3 == 0) and row_y == 1

    16: XXX    XXX
    17: XXX    XXX
    18: XXX XX XXX
    19: XXX    XXX

    (frame_counter & 3 == 0) and row_y == 2

    16: XX      XX
    17: XX      XX
    18: XX  XX  XX
    19: XX      XX

    (frame_counter & 3 == 0) and row_y == 3

    16: X        X
    17: X        X
    18: X   XX   X
    19: X        X


    (frame_counter & 3 == 0) and row_y == 4

    16:
    17:
    18:     XX
    19:

    """

    # clear previous tiles in case frame is lost.
    ranges_by_row_y = {
        0: (range(4, 5), range(5, 6)),
        1: (range(3, 5), range(5, 7)),
        2: (range(2, 5), range(5, 8)),
        3: (range(1, 5), range(5, 9)),
        4: (range(0, 5), range(5, 10)),
    }

    if frame_counter & 3:
        # This accounts for the variance in the line clear delay (17-20 frames)
        return playfield

    if row_y > 4:
        # The playstate should increment at the same time row_y hits 5.  This is a safeguard
        return playfield

    for row in completed_rows:
        if not row:
            # top row will never show animation
            continue
        offset = row * 10
        for blank_range in ranges_by_row_y[row_y]:
            for blank in blank_range:
                playfield[offset + blank] = BLANK_TILE
    return playfield


def update_playfield(
    previous: bytearray,
    current: bytearray,
    playstate: int,
    orientation_id: int,
    tetrimino_x: int,
    tetrimino_y: int,
    row_y: int,
    completed_rows: list[int],
    frame_counter: int,
) -> bytearray:
    ...
    """
    playstate:
        1 - process piece movements
        2 - lock tetrimino
        3 - check for rows
        4 - line clear animation
        5 - calculate score
        6 - b type goal check
        7 - process garbage
        8 - spawn next tetrimino


    1 requires overlaying the piece

    2 board is accurate.  Orientation id should be set to 0x13 until new piece spawns.

    3 board inaccurate.  each cleared row is reflected immediately.  

    4 board inaccurate.  line clear animation occurs

    5 \
    6   board is accurate.
    7 /

    8  requires overlaying the piece
    """

    if playstate in (1, 8):
        playfield = overlay_piece(current, tetrimino_x, tetrimino_y, orientation_id)

    elif playstate in (2, 5, 6, 7):
        playfield = current

    elif playstate == 3:
        playfield = previous

    elif playstate == 4:
        playfield = overlay_lineclear(previous, row_y, completed_rows, frame_counter)

    else:
        raise RuntimeError(f"Unexpected playstate {playstate}")

    return playfield



## NES pixel perfect sprites

In NES Tetris, blocks are 8x8 pixel sprites of 3 distinct kind like this:

### Color 2

Color 2 is the darker color of the level. Blocks contains the following elements:
* 1px vertical black border on right-most column
* 1px horizontal black border on bottom-most row
* "Shine" on the top-left corner, over a 3x3 area

Here is a sample at level 0:

![Color 2](./color2.png)

### Color 3

Color 2 is the darker color of the level. Blocks contains the following elements:
* 1px vertical black border on right-most column
* 1px horizontal black border on bottom-most row
* "Shine" on the top-left corner, over a 3x3 area

Here is a sample at level 0:

![Color 3](./color3.png)

### Color 1 (white)

Color 1 is the white, and it is a white square with a border of color 2, and a shine pixel on the top-left corner

Here is a sample at level 0:

![Color 3](./color1.png)


### Pieces

When each block contains its border on the bottom-right, it creates the illusion of a neat consistent spacing in between blocks.

And when pieces are positioned over a black background like the next box or the field itself, contiguous blocks appear nice and neat at 7x7 pixels, with a consistent spacing, like this:

![Next box](./next.png)


## Scaling at play

When using the native sprite pixel size, the whole Tetris interface is too small to play comfortably on any modern (and even older display). Here it is below at 1x resolution of 256x224:

![Classic UI at 1x pixel size](./classic_1x.png)


So TVs, emulator, and capture cards scale the native resolution to varying degree. For example, the UI might be scaled to 640x480 with some pixel something, like this:

![Classic UI at 640x480](./classic_640x480.png)

While this works great for human player, it poses a problem for doing OCR and board and block scanning, because scaling added bluriness to the image. See the next box scaled up now:

![Next box scaled up](./next_scaled_up.png)

Based on that If we were to try to identify the region of the blocks, how do know what should be included and what should be discarded?

![foo](./what_to_crop.png)

Say we could pick this region:

![foo](./next_cropped_area.png)

To identify some regions of the image again (shine, border), we want to scale back to nes pixel size. At NES pixel size, the Z piece here, cropped without its borders should be 23x15 pixel (8+8+7)x(8+7). But where we crop affects the result of normalization scaling. Like this:

Cropped Scaled up copy | Cropped Normalized copy | Cropped copy with region markers
---------------------- | ----------------------- | -----------------------
![foo](./next_crop_1.png) | ![foo](./next_normalized_1.png) | ![foo](./next_normalized_1_w_markers.png)
![foo](./next_crop_2.png) | ![foo](./next_normalized_2.png) | ![foo](./next_normalized_2_w_markers.png)


There are a few things to note here:

1. Small areas like the shine or 1px borders are severly affecting by scaling. In the normalized view, the borders are not deep black at all.
2. The center areas of the block are retaining their color


## Frame Scanning

### The Calibration UI

### Notable issues



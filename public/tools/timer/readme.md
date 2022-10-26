## Context

During qualifiers, people need a timer. Current solutions with screen cap of some random timers are lame. This offers a live web-based timer that can be loaded in a OBS browser source

## Usage

To test the timer in your browser, simply load the page:
https://nestrischamps.io/tools/timer/

To use the footer in OBS/SLOBS, add to your scene a new browser source, set its canva size to 268x44, and set the url to the url above.

Once that's done, you may position and scale the browser source in your scene as you see fit.

The timer starts immediately and requires no interaction. If you warm up first, just refresh the browser source one time to restart the timer.

There is no pause, the timer just runs on its own.


## Parameters

The timer can be parametrized with the following 4 query string arguments:
* `text_color`: a 6-digits hex color; defaults to `ffffff`
* `bg_color`: a 6-digits hex color; defaults to `000000`
* `minutes`: an integer between `1` and `5999`; defaults to `120`
* `type`: `up` or `down`; defaults to `down`

Sample query string:

```
?minutes=60&bg_color=ff0000&text_color&type=up
```

The parameters can be used in any combination. All prameters are optional can be ommitted.

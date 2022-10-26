## Context

Many of the competition layouts leave a 32px strip at the bottom of the layout for branding.

This provides a sample footer of ClassicTetris cycling banners.


## Usage

To test the footer in your browser, simply load the page:
https://nestrischamps.io/tools/footer/

To use the footer in OBS/SLOBS, add to your scene a new browser source, set its canva size to **`1280x32`**, and set the url to the url above.

Position the browser source at the bottom of your 720p layout.


## Parameters

The sample footer can be parametrized with the following 3 query string arguments:
* `system`: defaults to `NTSC`
* `event`: defaults to `SINGAPORE CHAMPIONSHIP 2021`
* `cycle_seconds`: defaults to `10`

Sample query string:

```
?system=PAL&event=Marq's%20garage%20party&cycle_seconds=5
```

The parameters can be used in any combination. All parameters are optional can be ommitted.

The values need to be [url-encoded](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) to display properly. If your event title is complex, use [this tool](https://www.onlinewebtoolkit.com/url-encode-decode) to encode it.
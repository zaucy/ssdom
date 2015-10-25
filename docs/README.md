# Documentation

## window.ssdom
`window.ssdom` is a special object available in each server script. It contains functions and data related to the current request. window.ssdom is an EventEmitter.

### Events
#### 'request'
This event is dispatched every time there is a non-public request. `window.location` should represent the new location.

#### 'pre-send'
Last chance to make changes to the document before being serialized and sent to the user.

Note: This event does not fire if `changeLocation()` has been called prior.

### Methods
#### .loadContent( pathname, cloned=false )
Reads the HTML file in pathname and parses it HTML elements. If the pathname has already been loaded it will skip reading the file and just pass the previously parsed file. If no file exists `null` is returned.

```javascript
// This will load the content of the current url
// and if it doesn't exist it will load the 404
// page instead.
var content = ssdom.loadContent(location.href);
if(content === null) {
  content = ssdom.loadContent("/404");
}
```

**Warning**: Changes to the returned elements will be present upon future loadContent() calls in the same session.

#### .loadData( pathname, copied=false )
Reads the JSON file in the pathname and parses it into a vanilla javascript object. If the pathname has already been loaded it will skip reading the file and just pass the previously parsed file. If no file exists `null` is returned. If an asterisk (\*) is present it will collect all file in the folder and return an object with the filename as the key without the extension.

Example:
```
// Hierarchy is like this
// /some/path/file1.json
// /some/path/file2.json
// /some/path/file2.json

// this is like calling loadData 3 times for each file in /some/path/
var myData = ssdom.loadData("/some/path/*.json");
// myData.file1
// myData.file2
// myData.file3
```

**Warning**: Changes to the returned javascript object will be present upon future loadData() calls in the same session.

#### .changeLocation( url )
Sets the http response header `Location` to the url provided and sends a `302` http response code. This function is also called when `window.location` is modified except in the case where only the hash was changed.

Relative urls and partial urls will be parsed. Examples: where current location is `http://www.example.com/wrong/page`
```
''       ->  http://www.example.com/wrong/page
'/'      ->  http://www.example.com/
'404'    ->  http://www.example.com/wrong/404
`/404`   ->  http://www.example.com/404
'www.example.com' -> http://www.example.com
```

Note: If the event [pre-send](#pre-send) has been fired `changeLocation()` does nothing.

#### .maintainSession()
> **( ! )** This has not been implemented yet

Every time a user makes a request for non-public content a session is made. Once the user is done with the request the session is destroyed. If `maintainSession()` is called, then the user will continue to use the same old session from before. That means any modification to content and data will be maintained every time a non-public resource is requested.

The dom will not clear and be re-made each request. This must be accounted for when using `maintainSession()`. Otherwise the user will continue to see the same content again and again.

If a maintained session is already present `maintainSession()` does nothing.

#### .destroySession()
> **( ! )** This has not been implemented yet

Destroys current session and generates a new one. Any maintained session will be destroyed and cleaned up.

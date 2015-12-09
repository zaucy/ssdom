"use strict";

module.exports = {
  // HTML file path string. Accepts special keywords in the string.
	// String special keywords:
	//    {HOSTNAME} - replaced with requesting hostname. Used for
	//                 running multiple sites on the same port
	main: "main.html",

	config: "ssdom.json",
	
  paths: {
		// Static files that get served to client.
    "public"   :  "public",

		// Content files accessed with ssdom.loadContent
    "content"  :  "private/content",

		// Data files accessed with ssdom.loadData
    "data"     :  "private/data",

		// Server-side scripts available
    "scripts"  :  "private/scripts"
  },
	// List of extension names available for use
	// Will install via NPM ssdom-ext-{EXTENSION_NAME}
	extensions: [

	]
};

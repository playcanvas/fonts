Overview
====================================

This repository contains scripts that allow you to render bitmap fonts using PlayCanvas.

Creating bitmap fonts
=====================

In order to render a font you first need to create one. There are various tools to create bitmap fonts, the most widely used at the moment
are:
- BMFont: http://www.angelcode.com/products/bmfont/
- Glyph Designer: http://71squared.com/en/glyphdesigner

These tools allow you to convert .ttf or .otf fonts to bitmap fonts. They have various settings but in the end they both allow you to export
a texture that contains all the characters of the font you want to use and an .fnt file that contains metadata for the bitmap font. So in order to create a font:
- Install the tool of your choice
- Pick the font you want to use and edit its settings to your liking
- Export the font. The metadata file should have an .fnt extension
- The exported texture must be a .png file. If it's not you can set it to a png in the export settings. Make sure to select a transparent background for the exported texture.
- If your font contains lots of characters the tool might try to export multiple textures to fit all of the characters. We currently
only support 1 texture so either select a subset of the characters in that font or select a bigger texture
- You should now have a texture with all the characters and an .fnt file.

fnt_to_json.py
==============

Next we need to convert the .fnt file to a .json file. To do that download fnt_to_json.py and run it like so:
```
python fnt_to_json.py font.fnt font.json
```

*NOTE: This script currently only works with Python 2.7.6 and below*

Rendering the font
===================

Next steps to render our font in the application:
- Upload the font texture that we exported from our tool of choice and the new .json file to PlayCanvas.
- Copy the *font_renderer.js* script in your project.
- Go to your pack and create a new Entity with a Script Component
- Add *font_renderer.js* to the Script Component

You will see a bunch of attributes for the font renderer. These specify which font to use, what text to render and also the positioning of our text on screen. Specifically:
- **text**: This is the text that will be rendered.
- **maxTextLength**: The maximum number of characters that this font renderer will ever render.
- **fontAtlas**: Set this to the font texture that you uploaded before.
- **fontJson**: Set this to the .json file that you uploaded before.
- **x**: This is the x **screen** position of the rendered text.
- **y**: This is the y **screen** position of the rendered text.
- **depth**: This is the z-index of the rendered text. If you want this text to appear behind other text or sprites, increase this value.
- **anchor**: Determines where on screen should the rendered text be anchored. You can anchor text in the center of the screen or its edges.
- **pivot**: Determines the text alignment (or pivot point).
- **tint**: A color to multiply the current color of the text with.
- **maxResHeight**: Set this to the target resolution height of your app. The final scale of the rendered text will be calculated as canvasHeight / maxResHeight.

You can also set all the properties of the font_renderer via script.

Script Events
=============

If you want the rendered text to be clickable you can register an event handler for the 'click' event via script. For example attach this
script on the same Entity as the font_renderer:

```
pc.script.create('myhandler', function (context) {
    var Myhandler = function (entity) {
        this.entity = entity;
    };

    Myhandler.prototype = {
        initialize: function () {
            this.entity.script.font_renderer.on('click', this.onClick, this);
        },

        onClick: function () {
            console.log('Click');
        }
    };

    return MyHandler;
});
```









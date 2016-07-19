var FontRenderer = pc.createScript('fontRenderer');

/**
 * Attributes
 */

FontRenderer.attributes.add('text', {
    type: 'string'
});

FontRenderer.attributes.add('maxTextLength', {
    type: 'number',
    default: 256,
    description: 'The maximum length of the text - used to set the initial size of the vertex buffer'
});

FontRenderer.attributes.add('fontAtlas', {
    type: 'asset',
    assetType: 'texture',
    description: 'The texture atlas that contains all the letters, this has to be a png file with an alpha channel'
});

FontRenderer.attributes.add('fontJson', {
    type: 'asset',
    assetType: 'json',
    description: 'JSON file that contains all the font metadata that was converted from an .fnt file'
});

FontRenderer.attributes.add('x', {
    type: 'number',
    default: 0,
    description: 'The x coordinate in pixels'
});

FontRenderer.attributes.add('y', {
    type: 'number',
    default: 0,
    description: 'The y coordinate in pixels'
});

FontRenderer.attributes.add('depth', {
    type: 'number',
    default: 1,
    description: 'The z depth of the font compared to other fonts'
});

FontRenderer.attributes.add('anchor', {
    type: 'number',
    default: 0,
    description: 'The anchor of the font related to the screen bounds',
    enum: [
        { 'topLeft': 0 },
        { 'top': 1 },
        { 'topRight': 2 },
        { 'left': 3 },
        { 'center': 4 },
        { 'right': 5 },
        { 'bottomLeft': 6 },
        { 'bottom': 7 },
        { 'bottomRight': 8 }
    ]
});

FontRenderer.attributes.add('pivot', {
    type: 'number',
    default: 0,
    description: 'The pivot point of the font',
    enum: [
        { 'topLeft': 0 },
        { 'top': 1 },
        { 'topRight': 2 },
        { 'left': 3 },
        { 'center': 4 },
        { 'right': 5 },
        { 'bottomLeft': 6 },
        { 'bottom': 7 },
        { 'bottomRight': 8 }
    ]
});

FontRenderer.attributes.add('tint', {
    type: 'rgba',
    description: 'A color that is multiplied with the current color of the font',
    default: [ 1, 1, 1, 1 ]
});

FontRenderer.attributes.add('maxResHeight', {
    type: 'number',
    default: 720,
    description: 'The maximum resolution height of the application. Used to scale the font accordingly.'
})


/**
 * Static variables
 */
FontRenderer.shader = null;
FontRenderer.vertexFormat = null;
FontRenderer.resolution = new pc.Vec2();


// initialize code called once per entity
FontRenderer.prototype.initialize = function() {
    var canvas = document.getElementById('application-canvas');

    this.userOffset = new pc.Vec2();
    this.offset = new pc.Vec2();
    this.scaling = new pc.Vec2();
    this.anchorOffset = new pc.Vec2();
    this.pivotOffset = new pc.Vec2();
    this.width = 0;
    this.height = 0;

    var app = this.app;

    // Create shader
    var gd = app.graphicsDevice;

    if (!FontRenderer.shader) {
        var shaderDefinition = {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION,
                aUv0: pc.SEMANTIC_TEXCOORD0
            },
            vshader: [
                "attribute vec2 aPosition;",
                "attribute vec2 aUv0;",
                "varying vec2 vUv0;",
                "uniform vec2 uResolution;",
                "uniform vec2 uOffset;",
                "uniform vec2 uScale;",
                "",
                "void main(void)",
                "{",
                "    gl_Position = vec4(2.0 * ((uScale * aPosition.xy + uOffset) / uResolution ) - 1.0, -0.9, 1.0);",
                "    vUv0 = aUv0;",
                "}"
            ].join("\n"),
            fshader: [
                "precision " + gd.precision + " float;",
                "",
                "varying vec2 vUv0;",
                "",
                "uniform vec4 vTint;",
                "",
                "uniform sampler2D uColorMap;",
                "",
                "void main(void)",
                "{",
                "    vec4 color = texture2D(uColorMap, vUv0);",
                "    gl_FragColor = vec4(color.rgb * vTint.rgb, color.a * vTint.a);",
                "}"
            ].join("\n")
        };

        FontRenderer.shader = new pc.Shader(gd, shaderDefinition);
    }


    // Create the vertex format
    if (!FontRenderer.vertexFormat) {
        FontRenderer.vertexFormat = new pc.VertexFormat(gd, [
            { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.ELEMENTTYPE_FLOAT32 },
            { semantic: pc.SEMANTIC_TEXCOORD0, components: 2, type: pc.ELEMENTTYPE_FLOAT32 }
        ]);
    }

    if (! this.fontAtlas)
        return;

    this.atlas = this.fontAtlas.resource;
    this.font = this.fontJson.resource;

    // Create a vertex buffer
    this.vertexBuffer = new pc.VertexBuffer(gd, FontRenderer.vertexFormat, 6*this.maxTextLength, pc.BUFFER_DYNAMIC);
    this.updateText(this.text);

    var command = new pc.Command(pc.LAYER_HUD, pc.BLEND_NORMAL, function () {
        if (this.entity.enabled) {
            // Set the shader
            gd.setShader(FontRenderer.shader);

            var oldBlending = gd.getBlending();
            var oldDepthTest = gd.getDepthTest();
            var oldDepthWrite = gd.getDepthWrite();
            gd.setBlending(true);
            gd.setDepthTest(false);
            gd.setDepthWrite(false);

            gd.setBlendFunction(pc.BLENDMODE_SRC_ALPHA, pc.BLENDMODE_ONE_MINUS_SRC_ALPHA);

            FontRenderer.resolution.set(canvas.offsetWidth, canvas.offsetHeight);

            gd.scope.resolve("uResolution").setValue(FontRenderer.resolution.data);
            gd.scope.resolve("uScale").setValue(this.calculateScaling().data);
            gd.scope.resolve("uOffset").setValue(this.calculateOffset().data);
            gd.scope.resolve("uColorMap").setValue(this.atlas);
            gd.scope.resolve("vTint").setValue(this.tint.data);

            // Set the vertex buffer
            gd.setVertexBuffer(this.vertexBuffer, 0);
            gd.draw({
                type: pc.PRIMITIVE_TRIANGLES,
                base: 0,
                count: this.text.length * 6,
                indexed: false
            });

            gd.setBlending(oldBlending);
            gd.setDepthTest(oldDepthTest);
            gd.setDepthWrite(oldDepthWrite);
        }
    }.bind(this));

    this.command = command;
    command.key = this.depth;
    app.scene.drawCalls.push(command);

    this.on('attr', this.onAttributeChanged, this);
    this.on('state', this.onState);
    this.on('destroy', this.onDestroy);

    app.mouse.on('mousedown', this.onMouseDown, this);
    if (app.touch)
        app.touch.on('touchstart', this.onTouchDown, this);

    this.onState();
};


FontRenderer.prototype.onMouseDown = function (e) {
    if (!this.eventsEnabled)
        return;

    this.onClick(e);
};

FontRenderer.prototype.onTouchDown = function (e)   {
    if (!this.eventsEnabled)
        return;

    this.onClick(e.changedTouches[0]);
};

/**
 * Calculates if the click has happened inside the rect of this
 * sprite and fires 'click' event if it has
 */
FontRenderer.prototype.onClick = function (cursor) {
    var canvas = this.app.graphicsDevice.canvas;
    var tlx, tly, brx, bry, mx, my;

    var scaling = this.scaling;
    var offset = this.offset;

    var width = this.width;
    var height = this.height;

    tlx = 2.0 * (scaling.x * 0 + offset.x) / FontRenderer.resolution.x - 1.0;
    tly = 2.0 * (scaling.y * 0 + offset.y) / FontRenderer.resolution.y - 1.0;


    brx = 2.0 * (scaling.x * width + offset.x) / FontRenderer.resolution.x - 1.0;
    bry = 2.0 * (scaling.y * (- height) + offset.y) / FontRenderer.resolution.y - 1.0;

    mx = (2.0 * cursor.x / canvas.offsetWidth) - 1;
    my = (2.0 * (canvas.offsetHeight - cursor.y) / canvas.offsetHeight) - 1;

    if (mx >= tlx && mx <= brx &&
        my <= tly && my >= bry) {
        this.fire('click');
    }
};

/**
 * Re-render the text if necessary
 */
FontRenderer.prototype.onAttributeChanged = function (name, newValue, oldValue) {
    this.eventsEnabled = false;

    if (name === 'text' ) {
        if (oldValue !== newValue)
            this.updateText();
    } else if (name === 'depth') {
        this.command.key = newValue;
    }
};

FontRenderer.prototype.getTotalOffset = function (result) {
    return result.copy(this.userOffset).add(this.alignOffset);
};

FontRenderer.prototype.updateText = function () {
    // Fill the vertex buffer
    this.vertexBuffer.lock();

    // the cursor controls the position of the next character to be drawn
    var cursorX = 0;
    var cursorY = 0;
    var tempCursorX = cursorX;
    var tempCursorY = cursorY;
    var uv0;
    var uv1;
    var uv2;
    var uv3;
    var text = this.text;
    var textLength = text.length;
    var i;

    this.width = 0;
    this.height = 0;

    var iterator = new pc.VertexIterator(this.vertexBuffer);
    for (i = 0; i < textLength; i++) {
        var charId = text.charCodeAt(i);
        var fontChar = this.font.chars[charId];
        // Check we have the requested character
        if (fontChar === undefined)
            continue;

        // Get the uv's for our letter - these will be looked up in the texture atlas
        uv0 = fontChar.x / this.font.common.scaleW;
        uv1 = 1 - (fontChar.y + fontChar.height) / (this.font.common.scaleH);
        uv2 = (fontChar.x + fontChar.width) / this.font.common.scaleW;
        uv3 = 1 - fontChar.y / this.font.common.scaleH;
        var width = fontChar.width;
        var height = fontChar.height;
        var xoffset = fontChar.xoffset;
        var yoffset = fontChar.yoffset;

        // offset the cursor by the appropriate amount for each letter
        tempCursorX = cursorX + xoffset;
        tempCursorY = -yoffset;

        this.width = Math.max(this.width, tempCursorX + width);
        this.height = Math.max(this.height, tempCursorY + height);

        // Add vertices
        iterator.element[pc.SEMANTIC_POSITION].set(tempCursorX, tempCursorY - height);
        iterator.element[pc.SEMANTIC_TEXCOORD0].set(uv0, uv1);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(tempCursorX + width, tempCursorY - height);
        iterator.element[pc.SEMANTIC_TEXCOORD0].set(uv2, uv1);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(tempCursorX, tempCursorY);
        iterator.element[pc.SEMANTIC_TEXCOORD0].set(uv0, uv3);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(tempCursorX + width, tempCursorY - height);
        iterator.element[pc.SEMANTIC_TEXCOORD0].set(uv2, uv1);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(tempCursorX + width, tempCursorY);
        iterator.element[pc.SEMANTIC_TEXCOORD0].set(uv2, uv3);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(tempCursorX, tempCursorY);
        iterator.element[pc.SEMANTIC_TEXCOORD0].set(uv0, uv3);

        if (i == textLength - 1) {
            iterator.end();
        } else {
            iterator.next();

            var nextId = text.charCodeAt(i+1);

            var kerning = 0;
            if (this.font.kernings[charId] && this.font.kernings[charId][nextId])
                kerning = this.font.kernings[charId][nextId]

            // Advance the cursor by xadvance adding kerning if necessary for the current character pair
            cursorX += (fontChar.xadvance + kerning);
        }
    }
    this.vertexBuffer.unlock();
};

FontRenderer.prototype.calculateOffset = function () {
    var canvas = this.app.graphicsDevice.canvas;
    this.calculateAnchorOffset();
    this.calculatePivotOffset();

    this.offset.set(this.x * this.scaling.x, this.y * this.scaling.y)
        .add(this.userOffset)
        .add(this.anchorOffset)
        .add(this.pivotOffset);

    this.offset.y += canvas.offsetHeight;
    return this.offset;
},

FontRenderer.prototype.calculateScaling = function () {
    var canvas = this.app.graphicsDevice.canvas;
    var scale = canvas.offsetHeight / this.maxResHeight;
    this.scaling.set(scale, scale);
    return this.scaling;
};

FontRenderer.prototype.calculateAnchorOffset = function () {
    var canvas = this.app.graphicsDevice.canvas;
    var width = canvas.offsetWidth;
    var height = canvas.offsetHeight;

    switch (this.anchor) {
        // top left
        case 0:
            this.anchorOffset.set(0,0);
            break;
        // top
        case 1:
            this.anchorOffset.set(width * 0.5, 0);
            break;
        // top right
        case 2:
            this.anchorOffset.set(width, 0);
            break;
        // left
        case 3:
            this.anchorOffset.set(0, -height * 0.5);
            break;
        // center
        case 4:
            this.anchorOffset.set(width * 0.5, -height * 0.5);
            break;
        // right
        case 5:
            this.anchorOffset.set(width, -height * 0.5);
            break;
        // bottom left
        case 6:
            this.anchorOffset.set(0, -height);
            break;
        // bottom
        case 7:
            this.anchorOffset.set(width/2, -height);
            break;
        // bottom right
        case 8:
            this.anchorOffset.set(width, -height);
            break;
        default:
            console.error('Wrong anchor: ' + this.anchor);
            break;
    }

    return this.anchorOffset;
},

FontRenderer.prototype.calculatePivotOffset = function () {
    var width = this.width * this.scaling.x;
    var height = this.height * this.scaling.y;

    switch (this.pivot) {
        // top left
        case 0:
            this.pivotOffset.set(0,0);
            break;
        // top
        case 1:
            this.pivotOffset.set(-width * 0.5, 0);
            break;
        // top right
        case 2:
            this.pivotOffset.set(-width, 0);
            break;
        // left
        case 3:
            this.pivotOffset.set(0, height * 0.5);
            break;
        // center
        case 4:
            this.pivotOffset.set(-width * 0.5, height * 0.5);
            break;
        // right
        case 5:
            this.pivotOffset.set(-width, height * 0.5);
            break;
        // bottom left
        case 6:
            this.pivotOffset.set(0, height);
            break;
        // bottom
        case 7:
            this.pivotOffset.set(-width/2, height);
            break;
        // bottom right
        case 8:
            this.pivotOffset.set(-width, height);
            break;
        default:
            console.error('Wrong pivot: ' + this.pivot);
            break;
    }

    return this.pivotOffset;
};

FontRenderer.prototype.onState = function (enabled) {
    this.eventsEnabled = false;
};

FontRenderer.prototype.update = function (dt) {
    this.eventsEnabled = true;
};

FontRenderer.prototype.onDestroy = function () {
    // remove draw call
    if (this.command) {
        var i = this.app.scene.drawCalls.indexOf(this.command);
        if (i >= 0)
            this.app.scene.drawCalls.splice(i, 1);
    }
};

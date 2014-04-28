/** 
 * Attributes
 */

pc.script.attribute('text', 'string');
// the maximum length of the text - used to set the initial size of the vertex buffer
pc.script.attribute('maxTextLength', 'number', 256);

// The texture atlas that contains all the letters - this has to be 
// a png file with alpha
pc.script.attribute('fontAtlas', 'asset', [], {
    type: 'texture',
    max: 1
});

// text json file that contains all the font metadata (converted from an .fnt file)
pc.script.attribute('fontJson', 'asset', [], {
    type: 'json',
    max: 1
});

pc.script.attribute('x', 'number');
pc.script.attribute('y', 'number');
pc.script.attribute('depth', 'number', 1)

pc.script.attribute('anchor', 'enumeration', 0, {
    enumerations: [{
        name: 'topLeft',
        value: 0
    }, {
        name: 'top',
        value: 1
    }, {
        name: 'topRight',
        value: 2
    }, {
        name: 'left',
        value: 3
    }, {
        name: 'center',
        value: 4
    }, {
        name: 'right',
        value: 5
    }, {
        name: 'bottomLeft',
        value: 6
    }, {
        name: 'bottom',
        value: 7
    }, {
        name: 'bottomRight',
        value: 8
    }]
});

pc.script.attribute('pivot', 'enumeration', 0, {
    enumerations: [{
        name: 'topLeft',
        value: 0
    }, {
        name: 'top',
        value: 1
    }, {
        name: 'topRight',
        value: 2
    }, {
        name: 'left',
        value: 3
    }, {
        name: 'center',
        value: 4
    }, {
        name: 'right',
        value: 5
    }, {
        name: 'bottomLeft',
        value: 6
    }, {
        name: 'bottom',
        value: 7
    }, {
        name: 'bottomRight',
        value: 8
    }]
});

pc.script.attribute('tint', 'rgba', [1,1,1,1]);

pc.script.attribute('maxResHeight', 'number', 720);

pc.script.create('font_renderer', function (context) {
    
    var shader = null;    
    var vertexFormat = null;
    var resolution = new pc.Vec2();

    // Creates a new Font_renderer instance
    var Font_renderer = function (entity) {
        this.entity = entity;
    };

    Font_renderer.prototype = {
        initialize: function () { 
            var canvas = document.getElementById('application-canvas');

            this.userOffset = new pc.Vec2();
            this.offset = new pc.Vec2();
            this.scaling = new pc.Vec2();
            this.anchorOffset = new pc.Vec2();
            this.pivotOffset = new pc.Vec2();
            this.width = 0;
            this.height = 0;

            // Create shader
            var gd = context.graphicsDevice;

            if (!shader) {
                var shaderDefinition = {
                    attributes: {
                        aPosition: pc.gfx.SEMANTIC_POSITION,
                        aUv0: pc.gfx.SEMANTIC_TEXCOORD0
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
        
                shader = new pc.gfx.Shader(gd, shaderDefinition);
            }
            
    
            // Create the vertex format
            if (!vertexFormat) {
                vertexFormat = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.gfx.SEMANTIC_TEXCOORD0, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);
            }


            // Load font assets
            var assets = [
                context.assets.getAssetByResourceId(this.fontAtlas),
                context.assets.getAssetByResourceId(this.fontJson),
            ];

            context.assets.load(assets).then(function (resources) {
                this.atlas = resources[0];
                this.font = resources[1];

                // Create a vertex buffer
                this.vertexBuffer = new pc.gfx.VertexBuffer(gd, vertexFormat, 6*this.maxTextLength, pc.gfx.BUFFER_DYNAMIC);
                this.updateText(this.text);
    
                var command = new pc.scene.Command(pc.scene.LAYER_HUD, pc.scene.BLEND_NORMAL, function () {
                    if (this.entity.enabled) {  
                        // Set the shader
                        gd.setShader(shader);

                        gd.setBlending(true);
                        gd.setBlendFunction(pc.gfx.BLENDMODE_SRC_ALPHA, pc.gfx.BLENDMODE_ONE_MINUS_SRC_ALPHA);
                        gd.setDepthWrite(false);

                        resolution.set(canvas.offsetWidth, canvas.offsetHeight);

                        gd.scope.resolve("uResolution").setValue(resolution.data);
                        gd.scope.resolve("uScale").setValue(this.calculateScaling().data);
                        gd.scope.resolve("uOffset").setValue(this.calculateOffset().data);
                        gd.scope.resolve("uColorMap").setValue(this.atlas);
                        gd.scope.resolve("vTint").setValue(this.tint.data);
                        
                        // Set the vertex buffer
                        gd.setVertexBuffer(this.vertexBuffer, 0);
                        gd.draw({
                            type: pc.gfx.PRIMITIVE_TRIANGLES,
                            base: 0,
                            count: this.text.length*6,
                            indexed: false
                        });
                    }
                }.bind(this));

                this.command = command;
                command.key = this.depth;
                context.scene.drawCalls.push(command);

                this.on('set', this.onAttributeChanged, this);

            }.bind(this));

            context.mouse.on('mousedown', this.onMouseDown, this);
            if (context.touch) {
                context.touch.on('touchstart', this.onTouchDown, this);
            }
        },


        onMouseDown: function (e) {
            if (!this.eventsEnabled) {
                return;
            }

            this.onClick(e);
        },

        onTouchDown: function (e) {
            if (!this.eventsEnabled) {
                return;
            }

            this.onClick(e.changedTouches[0]);
        },

        /**
         * Calculates if the click has happened inside the rect of this
         * sprite and fires 'click' event if it has
         */
        onClick: function (cursor) {
            var canvas = context.graphicsDevice.canvas;
            var tlx, tly, brx, bry, mx, my;


            var scaling = this.scaling;
            var offset = this.offset;

            tlx = 2.0 * (scaling.x * 0 + offset.x) / resolution.x - 1.0;
            tly = 2.0 * (scaling.y * 0 + offset.y) / resolution.y - 1.0;


            brx = 2.0 * (scaling.x * this.width + offset.x) / resolution.x - 1.0;
            bry = 2.0 * (scaling.y * (- this.height) + offset.y) / resolution.y - 1.0;

            mx = (2.0 * cursor.x / canvas.offsetWidth) - 1;
            my = (2.0 * (canvas.offsetHeight - cursor.y) / canvas.offsetHeight) - 1;

            if (mx >= tlx && mx <= brx && 
                my <= tly && my >= bry) {
                this.fire('click');
            } 
        },
        
        /**
         * Re-render the text if necessary
         */
        onAttributeChanged: function (name, oldValue, newValue) {
            this.eventsEnabled = false;

            if (name === 'text' ) {
                if (oldValue !== newValue) {
                    this.updateText(); 
                }   
            } else if (name === 'depth') {
                this.command.key = newValue;
            } 
        },
    
        getTotalOffset: function (result) {
            result.copy(this.userOffset).add(this.alignOffset);
            return result;
        },
        
        updateText: function () {
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
            var kerning = 0;
            var text = this.text;
            var textLength = text.length;

            this.width = 0;
            this.height = 0;

            var iterator = new pc.gfx.VertexIterator(this.vertexBuffer);
            for (i = 0; i < textLength; i++) {
                var charId = text.charCodeAt(i);
                var fontChar = this.font.chars[charId];
               
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
                tempCursorY = cursorY - yoffset;

                this.width = Math.max(this.width, tempCursorX + width);
                this.height = Math.max(this.height, tempCursorY + height);
                
                // Add vertices
                iterator.element[pc.gfx.SEMANTIC_POSITION].set(tempCursorX, tempCursorY - height);
                iterator.element[pc.gfx.SEMANTIC_TEXCOORD0].set(uv0, uv1);
                iterator.next();
                iterator.element[pc.gfx.SEMANTIC_POSITION].set(tempCursorX + width, tempCursorY - height);
                iterator.element[pc.gfx.SEMANTIC_TEXCOORD0].set(uv2, uv1);
                iterator.next();
                iterator.element[pc.gfx.SEMANTIC_POSITION].set(tempCursorX, tempCursorY);
                iterator.element[pc.gfx.SEMANTIC_TEXCOORD0].set(uv0, uv3);
                iterator.next();
                iterator.element[pc.gfx.SEMANTIC_POSITION].set(tempCursorX + width, tempCursorY - height);
                iterator.element[pc.gfx.SEMANTIC_TEXCOORD0].set(uv2, uv1);
                iterator.next();
                iterator.element[pc.gfx.SEMANTIC_POSITION].set(tempCursorX + width, tempCursorY);
                iterator.element[pc.gfx.SEMANTIC_TEXCOORD0].set(uv2, uv3);
                iterator.next();
                iterator.element[pc.gfx.SEMANTIC_POSITION].set(tempCursorX, tempCursorY);
                iterator.element[pc.gfx.SEMANTIC_TEXCOORD0].set(uv0, uv3);
                
                if (i == textLength - 1) {
                    iterator.end();
                } else {
                    iterator.next();

                    var nextId = text.charCodeAt(i+1);

                    kerning = this.font.kernings[charId] && this.font.kernings[charId][nextId] ? 
                              this.font.kernings[charId][nextId] :
                              0;
                    
                   // Advance the cursor by xadvance adding kerning if necessary for the current character pair
                    cursorX += (fontChar.xadvance + kerning);
                }
            }
            this.vertexBuffer.unlock();
        }, 

        calculateOffset: function () {
            var canvas = context.graphicsDevice.canvas;
            this.calculateAnchorOffset();
            this.calculatePivotOffset();

            this.offset.set(this.x * this.scaling.x, this.y * this.scaling.y)
            .add(this.userOffset)
            .add(this.anchorOffset)
            .add(this.pivotOffset);

            this.offset.y += canvas.offsetHeight;
            return this.offset;
        },

        calculateScaling: function () {
            var canvas = context.graphicsDevice.canvas;
            var scale = canvas.offsetHeight / this.maxResHeight;
            this.scaling.set(scale, scale);
            return this.scaling;
        },

        calculateAnchorOffset: function () {
            var canvas = context.graphicsDevice.canvas;
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

        calculatePivotOffset: function () {
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
        },
        
        onEnable: function () {
            this.eventsEnabled = false;
        },

        onDisable: function () {
            this.eventsEnabled = false;
        },

        update: function (dt) {
            this.eventsEnabled = true;
        },
    };

    return Font_renderer;
});
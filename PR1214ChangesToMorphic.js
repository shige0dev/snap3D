/*

    PR1214ChangesToMorphic.js

    This file is based on PR1214 described in https://github.com/jmoenig/Snap--Build-Your-Own-Blocks/pull/1214.
    
*/

// Global settings /////////////////////////////////////////////////////

// Global Functions ////////////////////////////////////////////////////

navigator.os = (function () {
    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('iphone os') !== -1)     // must before osx
        return 'ios';
    else if (ua.indexOf('android') !== -1)  // must before linux
        return 'android';
    else if (ua.indexOf('mac os x') !== -1)
        return 'osx';
    else if (ua.indexOf('linux') !== -1)
        return 'linux';
    else if (ua.indexOf('x11') !== -1)
        return 'unix';
    else if (ua.indexOf('win') !== -1)
        return 'windows';
    else
        return 'other';
})();

// CursorMorph /////////////////////////////////////////////////////////

CursorMorph.prototype.init = function (aStringOrTextMorph) {
    var ls;

    // additional properties:
    this.keyDownEventUsed = false;
    this.target = aStringOrTextMorph;
    this.originalContents = this.target.text;
    this.originalAlignment = this.target.alignment;
    this.slot = this.target.text.length;
    CursorMorph.uber.init.call(this);
    ls = fontHeight(this.target.fontSize);
    this.setExtent(new Point(Math.max(Math.floor(ls / 20), 1), ls));
    this.drawNew();
    this.image.getContext('2d').font = this.target.font();
    if (this.target instanceof TextMorph &&
            (this.target.alignment !== 'left')) {
        this.target.setAlignmentToLeft();
    }
    this.gotoSlot(this.slot);
    this.initializeTextarea();
};

CursorMorph.prototype.initializeTextarea = function () {
    // Add hidden text box for copying and pasting
    var myself = this,
        wrrld = this.target.world();

    this.textarea = document.createElement('textarea');
    this.textarea.style.position = 'absolute';
    this.textarea.style.pointerEvents = 'none';
    this.textarea.style.opacity = 0;
    this.textarea.style.zIndex = 0;
    this.textarea.style.height = (this.bounds.corner.y - this.bounds.origin.y) + 'px';
    this.textarea.id = 'txt' + Date.now(); // for debugging
    this.textarea.value = this.target.text;
    
    this.textarea.adjustPlacement = function () {
        var bounds = (myself.target instanceof StringMorph)? myself.target.parent.bounds : myself.target.bounds,
        width = bounds.corner.x - bounds.origin.x;
        if (this.style.left !== bounds.origin.x + 'px')
        this.style.left = bounds.origin.x + 'px';
        if (this.style.top !== myself.bounds.origin.y + 'px')
        this.style.top = myself.bounds.origin.y + 'px';
        if (this.style.width !== width + 'px')
        this.style.width = width + 'px';
    };
    
    this.textarea.adjustPlacement();

    document.body.appendChild(this.textarea);

    this.textarea.focus();

    this.textarea.addEventListener(
        'keypress',
        function (event) {
            myself.processKeyPress(event);
        },
        false
    );

    this.textarea.addEventListener(
        'keydown',
        function (event) {
            myself.processKeyDown(event);
            if (event.shiftKey) {
                wrrld.currentKey = 16;
            }
            if (event.keyCode >= 33 && event.keyCode <= 40) {
                // ignore cursor movement, delegated to CursorMorph
                event.preventDefault();
            }
            if (navigator.os === 'osx' && event.ctrlKey) {
                // some ctrl shortcuts (e.g. ctrl+a, ctrl+e) move cursor, leave them to CursorMorph
                event.preventDefault();
                return;
            }
        },
        false
    );

    this.textarea.addEventListener(
        'keyup',
        function (event) {
            wrrld.currentKey = null;
        },
        false
    );

    this.textarea.addEventListener(
        'input',
        function (event) {
            myself.target.text = event.target.value;
            myself.gotoSlot(event.target.selectionEnd);
            myself.target.startMark = event.target.selectionEnd;
            myself.target.endMark = event.target.selectionEnd;
            myself.target.changed();
            myself.target.drawNew();
            myself.target.changed();
            
            // target may change bound or scroll, need to adjust cursor one more time
            myself.gotoSlot(event.target.selectionEnd);
            this.adjustPlacement();
        },
        false
    );
    
};

CursorMorph.prototype.focus = function () {
    this.textarea.focus();
};

// CursorMorph event processing:

CursorMorph.prototype.processKeyPress = function (event) {
    // this.inspectKeyEvent(event);
    if (this.keyDownEventUsed) {
        this.keyDownEventUsed = false;
        return null;
    }
/*
    if (event.keyCode) { // Opera doesn't support charCode
        if (event.ctrlKey && (!event.altKey)) {
            this.ctrl(event.keyCode, event.shiftKey);
        } else if (event.metaKey) {
            this.cmd(event.keyCode, event.shiftKey);
         }
    } else if (event.charCode) { // all other browsers
        if (event.ctrlKey && (!event.altKey)) {
            this.ctrl(event.charCode, event.shiftKey);
        } else if (event.metaKey) {
            this.cmd(event.charCode, event.shiftKey);
        }
    }
*/
    // notify target's parent of key event
    this.target.escalateEvent('reactToKeystroke', event);
};

CursorMorph.prototype.processKeyDown = function (event) {
    // this.inspectKeyEvent(event);
    var shift = event.shiftKey,
        wordNavigation = event.ctrlKey || event.altKey,
        selecting = this.target.selection().length > 0;

    this.keyDownEventUsed = false;
    
    if (event.keyIdentifier === 'U+0009' ||
    event.keyIdentifier === 'Tab') {
        this.keyDownEventUsed = true;
        event.preventDefault();
        this.target.escalateEvent('reactToEdit', this.target);
        event.shiftKey ? this.target.backTab(this.target)
        : this.target.tab(this.target);
        return;
    }
    
    if (navigator.os === 'osx' && event.ctrlKey) {
        // no support for ctrl movements shortcuts on osx
        this.keyDownEventUsed = true;
        event.preventDefault();
        return;
    }

    if (event.ctrlKey && (!event.altKey)) {
        this.ctrl(event.keyCode, event.shiftKey);
        // notify target's parent of key event
        this.target.escalateEvent('reactToKeystroke', event);
    }
    if (event.metaKey) {
        this.cmd(event.keyCode, event.shiftKey);
        // notify target's parent of key event
        this.target.escalateEvent('reactToKeystroke', event);
    }

    switch (event.keyCode) {
    case 37:
        if (selecting && !shift && !wordNavigation) {
            this.gotoSlot(Math.min(this.target.startMark, this.target.endMark));
            this.target.clearSelection();
        } else {
            this.goLeft(
                    shift,
                    wordNavigation ?
                        this.slot - this.target.previousWordFrom(this.slot)
                        : 1);
        }
        this.keyDownEventUsed = true;
        break;
    case 39:
        if (selecting && !shift && !wordNavigation) {
            this.gotoSlot(Math.max(this.target.startMark, this.target.endMark));
            this.target.clearSelection();
        } else {
            this.goRight(
                    shift,
                    wordNavigation ?
                        this.target.nextWordFrom(this.slot) - this.slot
                        : 1);
        }
        this.keyDownEventUsed = true;
        break;
    case 38:
        this.goUp(shift);
        this.keyDownEventUsed = true;
        break;
    case 40:
        this.goDown(shift);
        this.keyDownEventUsed = true;
        break;
    case 36:
        this.goHome(shift);
        this.keyDownEventUsed = true;
        break;
    case 35:
        this.goEnd(shift);
        this.keyDownEventUsed = true;
        break;
    case 13:
        if ((this.target instanceof StringMorph) || shift) {
            this.accept();
        }
        this.keyDownEventUsed = true;
        break;
    case 27:
        this.cancel();
        this.keyDownEventUsed = true;
        break;
    default:
        nop();
        // this.inspectKeyEvent(event);
    }
    // notify target's parent of key event
    this.target.escalateEvent('reactToKeystroke', event);
};

// CursorMorph navigation:


CursorMorph.prototype.goLeft = function (shift, howMany) {
    if (shift || this.target.startMark === this.target.endMark)
    this.gotoSlot(this.slot - 1);
    else // if there's text selected, just go to beginning of selection
    this.gotoSlot(this.target.selectionStartSlot());
    this.updateTargetSelection(shift);
};

CursorMorph.prototype.goRight = function (shift, howMany) {
    if (shift || this.target.startMark === this.target.endMark)
    this.gotoSlot(this.slot + (howMany || 1));
    else // if there's text selected, just go to end of selection
    this.gotoSlot(this.target.selectionEndSlot());
    this.updateTargetSelection(shift);
};

CursorMorph.prototype.goUp = function (shift) {
    this.gotoSlot(this.target.upFrom(this.slot));
    this.updateTargetSelection(shift);
};

CursorMorph.prototype.goDown = function (shift) {
    this.gotoSlot(this.target.downFrom(this.slot));
    this.updateTargetSelection(shift);
};

CursorMorph.prototype.goHome = function (shift) {
    this.gotoSlot(this.target.startOfLine(this.slot));
    this.updateTargetSelection(shift);
};

CursorMorph.prototype.goEnd = function (shift) {
    this.gotoSlot(this.target.endOfLine(this.slot));
    this.updateTargetSelection(shift);
};

CursorMorph.prototype.goFirst = function (shift) {
    this.gotoSlot(0);
    this.updateTargetSelection(shift);
};

CursorMorph.prototype.goLast = function (shift) {
    this.gotoSlot(this.target.text.length);
    this.updateTargetSelection(shift);
};



// CursorMorph selecting:

CursorMorph.prototype.updateTargetSelection = function (shift) {
    if (shift) {
        if (this.target.endMark !== this.slot) {
            this.target.endMark = this.slot;
        }
    } else {
        this.target.startMark = this.slot;
        this.target.endMark = this.slot;
    }
    if (this.textarea) {
        this.updateTextareaSelection();
    }
    this.target.changed();
    this.target.drawNew();
    this.target.changed();
};

CursorMorph.prototype.updateTextareaSelection = function () {
    this.textarea.selectionStart = this.target.selectionStartSlot();
    this.textarea.selectionEnd = this.target.selectionEndSlot();
    this.textarea.adjustPlacement();
};

// CursorMorph editing:






CursorMorph.prototype.ctrl = function (aChar, shiftKey) {
    if (aChar === 65) {//Ctrl+A
        this.target.selectAll();
    } else if (aChar === 37) {     // Ctrl+Left
        this.goHome(shiftKey);
    } else if (aChar === 39) {     // Ctrl+Right
        this.goEnd(shiftKey);
    } else if (aChar === 38) {     // Ctrl+Up
        this.goFirst(shiftKey);
    } else if (aChar === 40) {     // Ctrl+Down
        this.goLast(shiftKey);
    } else if (!isNil(this.target.receiver)) {
        if (aChar === 68) {//Ctrl+D
            this.target.doIt();
        } else if (aChar === 73) {//Ctrl+I
            this.target.inspectIt();
        } else if (aChar === 80) {//Ctrl+P
            this.target.showIt();
        }
    }
};

CursorMorph.prototype.cmd = function (aChar, shiftKey) {
    if (aChar === 65) {
        this.target.selectAll();
    } else if (aChar === 37) {     // Command+Left
        this.goHome(shiftKey);
    } else if (aChar === 39) {     // Command+Right
        this.goEnd(shiftKey);
    } else if (aChar === 38) {     // Command+Up
        this.goFirst(shiftKey);
    } else if (aChar === 40) {     // Command+Down
        this.goLast(shiftKey);
    } else if (!isNil(this.target.receiver)) {
        if (aChar === 68) {
            this.target.doIt();
        } else if (aChar === 73) {
            this.target.inspectIt();
        } else if (aChar === 80) {
            this.target.showIt();
        }
    }
};

// CursorMorph destroying:

CursorMorph.prototype.destroy = function () {
    if (this.target.alignment !== this.originalAlignment) {
        this.target.alignment = this.originalAlignment;
        this.target.drawNew();
        this.target.changed();
    }
    this.destroyTextarea();
    CursorMorph.uber.destroy.call(this);
};

CursorMorph.prototype.destroyTextarea = function () {
    var nodes = document.body.children,
        each,
        i;
    if (this.textarea) {
        for (i = 0; i < nodes.length; i += 1) {
            each = nodes[i];
            if (each === this.textarea) {
                document.body.removeChild(this.textarea);
                this.textarea = null;
            }
        }
    }
};



// StringMorph /////////////////////////////////////////////////////////


StringMorph.prototype.upFrom = function (slot) {
    // answer the slot above the given one
    return 0;
};

StringMorph.prototype.downFrom = function (slot) {
    // answer the slot below the given one
    return this.text.length;
};

StringMorph.prototype.startOfLine = function () {
    // answer the first slot (index) of the line for the given slot
    return 0;
};

StringMorph.prototype.selectionEndSlot = function () {
    return Math.max(this.startMark, this.endMark);
};


StringMorph.prototype.selectAll = function () {
    var cursor;
    if (this.isEditable) {
        this.startMark = 0;
        this.endMark = this.text.length;
        this.drawNew();
        this.changed();
        cursor = this.root().cursor;
        if (cursor) {
            cursor.gotoSlot(this.text.length);
            cursor.updateTextareaSelection();
        }
    }
};


StringMorph.prototype.mouseClickLeft = function (pos) {
    var cursor;
    if (this.isEditable) {
        if (!this.currentlySelecting) {
            this.edit(); // creates a new cursor
        }
        cursor = this.root().cursor;
        if (cursor) {
            cursor.gotoPos(pos);
            cursor.updateTextareaSelection();
        }
        this.currentlySelecting = true;
    } else {
        this.escalateEvent('mouseClickLeft', pos);
    }
};


StringMorph.prototype.enableSelecting = function () {
    this.mouseDownLeft = function (pos) {
        var crs = this.root().cursor,
            already = crs ? crs.target === this : false;
        if (this.world().currentKey === 16) {
            this.shiftClick(pos);
        } else {
            this.clearSelection();
            if (this.isEditable && (!this.isDraggable)) {
                this.edit();
                this.root().cursor.gotoPos(pos);
                this.startMark = this.slotAt(pos);
                this.endMark = this.startMark;
                this.root().cursor.updateTextareaSelection();
                this.currentlySelecting = true;
                if (!already) {this.escalateEvent('mouseDownLeft', pos); }
            }
        }
    };
    this.mouseMove = function (pos) {
        var crs = this.root().cursor;
        if (this.isEditable &&
                this.currentlySelecting &&
                (!this.isDraggable)) {
            var newMark = this.slotAt(pos);
            if (newMark !== this.endMark) {
                this.endMark = newMark;
                if (crs) crs.updateTextareaSelection();
                this.drawNew();
                this.changed();
            }
        }
    };
};


// TextMorph ////////////////////////////////////////////////////////////////

TextMorph.prototype.parse = function () {
    var myself = this,
        paragraphs = this.text.split('\n'),
        canvas = newCanvas(),
        context = canvas.getContext('2d'),
        oldline = '',
        newline,
        w,
        slot = 0;

    context.font = this.font();
    this.maxLineWidth = 0;
    this.lines = [];
    this.lineSlots = [0];
    this.words = [];

    paragraphs.forEach(function (p) {
        myself.words = myself.words.concat(p.split(' '));
        myself.words.push('\n');
    });

    this.words.forEach(function (word) {
        if (word === '\n') {
            myself.lines.push(oldline);
            myself.lineSlots.push(slot);
            myself.maxLineWidth = Math.max(
                myself.maxLineWidth,
                context.measureText(oldline).width
            );
            oldline = '';
        } else {
            if (myself.maxWidth > 0) {
                newline = oldline + word + ' ';
                w = context.measureText(newline).width;
                    if (w > myself.maxWidth && oldline !== '') {
                    myself.lines.push(oldline);
                    myself.lineSlots.push(slot);
                    myself.maxLineWidth = Math.max(
                        myself.maxLineWidth,
                        context.measureText(oldline).width
                    );
                    oldline = word + ' ';
                } else {
                    oldline = newline;
                }
            } else {
                oldline = oldline + word + ' ';
            }
            slot += word.length + 1;
        }
    });
};


TextMorph.prototype.upFrom = function (slot) {
    // answer the slot above the given one
    var above,
        colRow = this.columnRow(slot);
    if (colRow.y < 1) {
        return 0;
    }
    above = this.lines[colRow.y - 1];
    if (above.length <= colRow.x) {
        return this.lineSlots[colRow.y - 1] + above.length - 1;
    }
    return this.lineSlots[colRow.y - 1] + colRow.x;
};

TextMorph.prototype.downFrom = function (slot) {
    // answer the slot below the given one
    var below,
        colRow = this.columnRow(slot);
    if (colRow.y > this.lines.length - 2) {
        return this.text.length;
    }
    below = this.lines[colRow.y + 1];
    if (below.length <= colRow.x) {
        return this.lineSlots[colRow.y + 1] + below.length - 1;
    }
    return this.lineSlots[colRow.y + 1] + colRow.x;
};

TextMorph.prototype.selectionEndSlot = StringMorph.prototype.selectionEndSlot;

TextMorph.prototype.clearSelection = StringMorph.prototype.clearSelection;

// WorldMorph //////////////////////////////////////////////////////////


WorldMorph.prototype.initEventListeners = function () {
    var canvas = this.worldCanvas, myself = this;

    if (myself.useFillPage) {
        myself.fillPage();
    } else {
        this.changed();
    }

    canvas.addEventListener(
        "mousedown",
        function (event) {
            event.preventDefault();
            canvas.focus();
            myself.hand.processMouseDown(event);
        },
        false
    );

    canvas.addEventListener(
        "touchstart",
        function (event) {
            myself.hand.processTouchStart(event);
        },
        false
    );

    canvas.addEventListener(
        "mouseup",
        function (event) {
            event.preventDefault();
            myself.hand.processMouseUp(event);
        },
        false
    );

    canvas.addEventListener(
        "dblclick",
        function (event) {
            event.preventDefault();
            myself.hand.processDoubleClick(event);
        },
        false
    );

    canvas.addEventListener(
        "touchend",
        function (event) {
            myself.hand.processTouchEnd(event);
        },
        false
    );

    canvas.addEventListener(
        "mousemove",
        function (event) {
            myself.hand.processMouseMove(event);
        },
        false
    );

    canvas.addEventListener(
        "touchmove",
        function (event) {
            myself.hand.processTouchMove(event);
        },
        false
    );

    canvas.addEventListener(
        "contextmenu",
        function (event) {
            // suppress context menu for Mac-Firefox
            event.preventDefault();
        },
        false
    );

    canvas.addEventListener(
        "keydown",
        function (event) {
            // remember the keyCode in the world's currentKey property
            myself.currentKey = event.keyCode;
            if (myself.keyboardReceiver) {
                myself.keyboardReceiver.processKeyDown(event);
            }
            // supress backspace override
            if (event.keyCode === 8) {
                event.preventDefault();
            }
            // supress tab override and make sure tab gets
            // received by all browsers
            if (event.keyCode === 9) {
                if (myself.keyboardReceiver) {
                    myself.keyboardReceiver.processKeyPress(event);
                }
                event.preventDefault();
            }
            if ((event.ctrlKey && (!event.altKey) || event.metaKey) &&
                    (event.keyCode !== 86)) { // allow pasting-in
                event.preventDefault();
            }
        },
        false
    );

    canvas.addEventListener(
        "keyup",
        function (event) {
            // flush the world's currentKey property
            myself.currentKey = null;
            // dispatch to keyboard receiver
            if (myself.keyboardReceiver) {
                if (myself.keyboardReceiver.processKeyUp) {
                    myself.keyboardReceiver.processKeyUp(event);
                }
            }
            event.preventDefault();
        },
        false
    );

    canvas.addEventListener(
        "keypress",
        function (event) {
            if (myself.keyboardReceiver) {
                myself.keyboardReceiver.processKeyPress(event);
            }
            event.preventDefault();
        },
        false
    );

    canvas.addEventListener( // Safari, Chrome
        "mousewheel",
        function (event) {
            myself.hand.processMouseScroll(event);
            event.preventDefault();
        },
        false
    );
    canvas.addEventListener( // Firefox
        "DOMMouseScroll",
        function (event) {
            myself.hand.processMouseScroll(event);
            event.preventDefault();
        },
        false
    );


    window.addEventListener(
        "dragover",
        function (event) {
            event.preventDefault();
        },
        false
    );
    window.addEventListener(
        "drop",
        function (event) {
            myself.hand.processDrop(event);
            event.preventDefault();
        },
        false
    );

    window.addEventListener(
        "resize",
        function () {
            if (myself.useFillPage) {
                myself.fillPage();
            }
        },
        false
    );

    window.onbeforeunload = function (evt) {
        var e = evt || window.event,
            msg = "Are you sure you want to leave?";
        // For IE and Firefox
        if (e) {
            e.returnValue = msg;
        }
        // For Safari / chrome
        return msg;
    };
};


WorldMorph.prototype.nextTab = function (editField) {
    var next = this.nextEntryField(editField);
    if (next) {
        editField.clearSelection();
        next.edit();
        next.selectAll();
    }
};

WorldMorph.prototype.previousTab = function (editField) {
    var prev = this.previousEntryField(editField);
    if (prev) {
        editField.clearSelection();
        prev.edit();
        prev.selectAll();
    }
};


WorldMorph.prototype.edit = function (aStringOrTextMorph) {
    var pos = getDocumentPositionOf(this.worldCanvas);

    if (!aStringOrTextMorph.isEditable) {
        return null;
    }
    if (this.cursor && this.cursor.target !== aStringOrTextMorph) {
        this.cursor.destroy();
        this.cursor = null;
    }
    if (!this.cursor) {
        this.cursor = new CursorMorph(aStringOrTextMorph);
        aStringOrTextMorph.parent.add(this.cursor);
    }
    else {
        this.cursor.focus();
    }
    this.keyboardReceiver = this.cursor;

    this.initVirtualKeyboard();
    if (MorphicPreferences.isTouchDevice
            && MorphicPreferences.useVirtualKeyboard) {
        this.virtualKeyboard.style.top = this.cursor.top() + pos.y + "px";
        this.virtualKeyboard.style.left = this.cursor.left() + pos.x + "px";
        this.virtualKeyboard.focus();
    }

    if (MorphicPreferences.useSliderForInput) {
        if (!aStringOrTextMorph.parentThatIsA(MenuMorph)) {
            this.slide(aStringOrTextMorph);
        }
    }

    if (this.lastEditedText !== aStringOrTextMorph) {
        aStringOrTextMorph.escalateEvent('freshTextEdit', aStringOrTextMorph);
    }
    this.lastEditedText = aStringOrTextMorph;
};


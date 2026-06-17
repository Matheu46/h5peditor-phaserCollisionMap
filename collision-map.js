var H5PEditor = H5PEditor || {};

H5PEditor.PhaserCollisionMap = function (parent, field, params, setValue) {
  this.parent = parent;
  this.field = field;
  this.params = params;
  this.setValue = setValue;

  this.rectangles = [];
  if (this.params) {
    try {
      this.rectangles = JSON.parse(this.params);
      if (!Array.isArray(this.rectangles)) {
        this.rectangles = [];
      }
    } catch (e) {
      this.rectangles = [];
    }
  }

  this.isDrawing = false;
  this.startX = 0;
  this.startY = 0;
  this.currentRect = null;

  this.$container = null;
  this.$imageWrapper = null;
  this.$image = null;
};

H5PEditor.PhaserCollisionMap.prototype.appendTo = function ($wrapper) {
  var self = this;

  this.$container = H5PEditor.$('<div>', {
    'class': 'field text h5p-editor-phaser-collision-map-field'
  });

  H5PEditor.$('<span class="h5peditor-label"></span>').html(this.field.label).appendTo(this.$container);

  if (this.field.description) {
    H5PEditor.$('<span class="h5peditor-field-description"></span>').html(this.field.description).appendTo(this.$container);
  }

  this.$imageWrapper = H5PEditor.$('<div>', {
    'class': 'h5p-editor-phaser-collision-map'
  }).appendTo(this.$container);

  this.$container.appendTo($wrapper);

  this.findImageField();
};

H5PEditor.PhaserCollisionMap.prototype.findImageField = function () {
  var self = this;

  var imageField = null;
  if (this.parent.children) {
    for (var i = 0; i < this.parent.children.length; i++) {
      if (this.parent.children[i].field.name === 'backgroundImage') {
        imageField = this.parent.children[i];
        break;
      }
    }
  }

  if (imageField) {
    if (imageField.params && imageField.params.path) {
      this.renderImage(imageField.params.path);
    }

    // Fallback if changes array is not directly available or different API version
    if (imageField.changes) {
      imageField.changes.push(function () {
        if (imageField.params && imageField.params.path) {
          self.renderImage(imageField.params.path);
        } else {
          self.$imageWrapper.empty();
        }
      });
    }
  } else {
    setTimeout(function () {
      self.findImageField();
    }, 500);
  }
};

H5PEditor.PhaserCollisionMap.prototype.renderImage = function (path) {
  var self = this;
  this.$imageWrapper.empty();

  var imageSrc = H5P.getPath(path, H5PEditor.contentId);

  this.$image = H5PEditor.$('<img>', {
    src: imageSrc,
    draggable: false
  }).appendTo(this.$imageWrapper);

  this.$image.on('load', function () {
    self.renderRectangles();
  });

  this.$imageWrapper.on('mousedown', function (e) {
    if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') return;
    if (e.target !== self.$image[0] && e.target !== self.$imageWrapper[0]) return;
    e.preventDefault(); // Prevent text selection

    self.isDrawing = true;
    var rect = self.$imageWrapper[0].getBoundingClientRect();
    self.startX = e.clientX - rect.left;
    self.startY = e.clientY - rect.top;

    self.currentRect = H5PEditor.$('<div>', {
      'class': 'collision-box'
    }).css({
      left: self.startX + 'px',
      top: self.startY + 'px',
      width: 0,
      height: 0
    }).appendTo(self.$imageWrapper);
  });

  this.$imageWrapper.on('mousemove', function (e) {
    if (!self.isDrawing) return;

    var rect = self.$imageWrapper[0].getBoundingClientRect();
    var currentX = e.clientX - rect.left;
    var currentY = e.clientY - rect.top;

    currentX = Math.max(0, Math.min(currentX, rect.width));
    currentY = Math.max(0, Math.min(currentY, rect.height));

    var left = Math.min(self.startX, currentX);
    var top = Math.min(self.startY, currentY);
    var width = Math.abs(currentX - self.startX);
    var height = Math.abs(currentY - self.startY);

    self.currentRect.css({
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: height + 'px'
    });
  });

  this.$imageWrapper.on('mouseup', function (e) {
    if (!self.isDrawing) return;
    self.isDrawing = false;

    var widthStr = self.currentRect.css('width');
    var heightStr = self.currentRect.css('height');
    var leftStr = self.currentRect.css('left');
    var topStr = self.currentRect.css('top');

    var width = parseFloat(widthStr);
    var height = parseFloat(heightStr);

    if (width > 5 && height > 5) {
      var domRect = self.$imageWrapper[0].getBoundingClientRect();
      var scaleX = self.$image[0].naturalWidth / domRect.width;
      var scaleY = self.$image[0].naturalHeight / domRect.height;

      var left = parseFloat(leftStr);
      var top = parseFloat(topStr);

      var realBox = {
        x: Math.round(left * scaleX),
        y: Math.round(top * scaleY),
        width: Math.round(width * scaleX),
        height: Math.round(height * scaleY)
      };

      self.rectangles.push(realBox);
      self.save();
      self.renderRectangles();
    }

    if (self.currentRect) {
      self.currentRect.remove();
      self.currentRect = null;
    }
  });

  this.$imageWrapper.on('mouseleave', function (e) {
    if (self.isDrawing) {
      self.isDrawing = false;
      if (self.currentRect) {
        self.currentRect.remove();
        self.currentRect = null;
      }
    }
  });
};

H5PEditor.PhaserCollisionMap.prototype.renderRectangles = function () {
  var self = this;

  this.$imageWrapper.find('.collision-box').remove();

  if (!this.$image || !this.$image[0].naturalWidth) return;

  var domRect = this.$imageWrapper[0].getBoundingClientRect();
  if (domRect.width === 0) return;

  var scaleX = domRect.width / this.$image[0].naturalWidth;
  var scaleY = domRect.height / this.$image[0].naturalHeight;

  for (var i = 0; i < this.rectangles.length; i++) {
    var box = this.rectangles[i];

    var $box = H5PEditor.$('<div>', {
      'class': 'collision-box',
      'data-index': i
    }).css({
      left: (box.x * scaleX) + 'px',
      top: (box.y * scaleY) + 'px',
      width: (box.width * scaleX) + 'px',
      height: (box.height * scaleY) + 'px'
    }).appendTo(this.$imageWrapper);

    var $deleteBtn = H5PEditor.$('<div>', {
      'class': 'delete-btn',
      'text': '×',
      'title': 'Remover'
    }).appendTo($box);

    var $input = H5PEditor.$('<input>', {
      type: 'text',
      placeholder: 'Item (Opc.)',
      value: box.requiredItem || ''
    }).appendTo($box);

    $input.on('mousedown', function (e) {
      e.stopPropagation();
    });

    $input.on('change', function (e) {
      var index = parseInt(H5PEditor.$(this).parent().attr('data-index'), 10);
      self.rectangles[index].requiredItem = this.value;
      self.save();
    });

    $deleteBtn.on('mousedown', function (e) {
      e.stopPropagation();
      var index = parseInt(H5PEditor.$(this).parent().attr('data-index'), 10);
      self.rectangles.splice(index, 1);
      self.save();
      self.renderRectangles();
    });
  }
};

H5PEditor.PhaserCollisionMap.prototype.save = function () {
  var value = JSON.stringify(this.rectangles);
  this.params = value;
  this.setValue(this.field, value);
};

H5PEditor.PhaserCollisionMap.prototype.validate = function () {
  return true;
};

H5PEditor.widgets.phaserCollisionMap = H5PEditor.PhaserCollisionMap;

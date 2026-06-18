var H5PEditor = H5PEditor || {};

H5PEditor.PhaserCollisionMap = function (parent, field, params, setValue) {
  this.parent = parent;
  this.field = field;
  this.params = params;
  this.setValue = setValue;

  this.mapData = { walls: [], points: [] };
  this.mode = 'walls';
  if (this.params) {
    try {
      var parsed = JSON.parse(this.params);
      if (Array.isArray(parsed)) {
        this.mapData.walls = parsed;
      } else if (parsed && typeof parsed === 'object') {
        this.mapData = parsed;
        if (!this.mapData.walls) this.mapData.walls = [];
        if (!this.mapData.points) this.mapData.points = [];
      }
    } catch (e) {
      this.mapData = { walls: [], points: [] };
    }
  }

  this.isDrawing = false;
  this.dragIndex = -1;
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

  this.$toolbar = H5PEditor.$('<div>', {
    'class': 'h5p-phaser-toolbar'
  }).appendTo(this.$container);

  this.$btnWalls = H5PEditor.$('<button>', {
    text: 'Desenhar Paredes',
    'class': 'active'
  }).on('click', function(e) {
    e.preventDefault();
    self.mode = 'walls';
    self.$btnWalls.addClass('active');
    self.$btnPoints.removeClass('active');
    self.$imageWrapper.removeClass('mode-points').addClass('mode-walls');
  }).appendTo(this.$toolbar);

  this.$btnPoints = H5PEditor.$('<button>', {
    text: 'Adicionar Ponto de Interação'
  }).on('click', function(e) {
    e.preventDefault();
    self.mode = 'points';
    self.$btnPoints.addClass('active');
    self.$btnWalls.removeClass('active');
    self.$imageWrapper.removeClass('mode-walls').addClass('mode-points');
  }).appendTo(this.$toolbar);

  this.$imageWrapper = H5PEditor.$('<div>', {
    'class': 'h5p-editor-phaser-collision-map mode-' + this.mode
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
  }).on('dragstart', function(e) {
    e.preventDefault();
  }).appendTo(this.$imageWrapper);

  this.$image.on('load', function () {
    self.renderMapData();
  });

  this.$imageWrapper.on('mousedown', function (e) {
    if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') return;
    if (e.target.classList && e.target.classList.contains('delete-btn')) return;
    if (e.target !== self.$image[0] && e.target !== self.$imageWrapper[0]) return;
    e.preventDefault(); // Prevent text selection

    var rect = self.$imageWrapper[0].getBoundingClientRect();
    var currentX = e.clientX - rect.left;
    var currentY = e.clientY - rect.top;

    if (self.mode === 'walls') {
      self.isDrawing = true;
      self.startX = currentX;
      self.startY = currentY;

      self.currentRect = H5PEditor.$('<div>', {
        'class': 'collision-box'
      }).css({
        left: self.startX + 'px',
        top: self.startY + 'px',
        width: 0,
        height: 0
      }).appendTo(self.$imageWrapper);
    } else if (self.mode === 'points') {
      var scaleX = self.$image[0].naturalWidth / rect.width;
      var scaleY = self.$image[0].naturalHeight / rect.height;

      var realX = Math.round(currentX * scaleX);
      var realY = Math.round(currentY * scaleY);

      self.mapData.points.push({ id: Date.now(), x: realX, y: realY });
      self.save();
      self.renderMapData();
    }
  });

  this.$imageWrapper.on('mousemove', function (e) {
    var rect = self.$imageWrapper[0].getBoundingClientRect();
    var currentX = e.clientX - rect.left;
    var currentY = e.clientY - rect.top;

    currentX = Math.max(0, Math.min(currentX, rect.width));
    currentY = Math.max(0, Math.min(currentY, rect.height));

    if (self.mode === 'walls' && self.isDrawing) {
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
    } else if (self.mode === 'walls' && self.dragIndex > -1) {
      var scaleX = self.$image[0].naturalWidth / rect.width;
      var scaleY = self.$image[0].naturalHeight / rect.height;

      var dx = (currentX - self.startX) * scaleX;
      var dy = (currentY - self.startY) * scaleY;

      var boxData = self.mapData.walls[self.dragIndex];
      boxData.x = Math.round(self.initialBoxX + dx);
      boxData.y = Math.round(self.initialBoxY + dy);

      boxData.x = Math.max(0, Math.min(boxData.x, self.$image[0].naturalWidth - boxData.width));
      boxData.y = Math.max(0, Math.min(boxData.y, self.$image[0].naturalHeight - boxData.height));

      var $draggedBox = self.$imageWrapper.find('.collision-box[data-index="' + self.dragIndex + '"]');
      $draggedBox.css({
        left: (boxData.x / scaleX) + 'px',
        top: (boxData.y / scaleY) + 'px'
      });
    } else if (self.mode === 'points' && self.dragIndex > -1) {
      var scaleX = self.$image[0].naturalWidth / rect.width;
      var scaleY = self.$image[0].naturalHeight / rect.height;

      var dx = (currentX - self.startX) * scaleX;
      var dy = (currentY - self.startY) * scaleY;

      var pointData = self.mapData.points[self.dragIndex];
      pointData.x = Math.round(self.initialBoxX + dx);
      pointData.y = Math.round(self.initialBoxY + dy);

      pointData.x = Math.max(0, Math.min(pointData.x, self.$image[0].naturalWidth));
      pointData.y = Math.max(0, Math.min(pointData.y, self.$image[0].naturalHeight));

      var $draggedPin = self.$imageWrapper.find('.interaction-pin[data-index="' + self.dragIndex + '"]');
      $draggedPin.css({
        left: (pointData.x / scaleX) + 'px',
        top: (pointData.y / scaleY) + 'px'
      });
    }
  });

  this.$imageWrapper.on('mouseup', function (e) {
    if (self.isDrawing) {
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

        self.mapData.walls.push(realBox);
        self.save();
        self.renderMapData();
      }

      if (self.currentRect) {
        self.currentRect.remove();
        self.currentRect = null;
      }
    } else if (self.dragIndex > -1) {
      self.dragIndex = -1;
      self.save();
    }
  });

  this.$imageWrapper.on('mouseleave', function (e) {
    if (self.isDrawing) {
      self.isDrawing = false;
      if (self.currentRect) {
        self.currentRect.remove();
        self.currentRect = null;
      }
    } else if (self.dragIndex > -1) {
      self.dragIndex = -1;
      self.save();
    }
  });
};

H5PEditor.PhaserCollisionMap.prototype.renderMapData = function () {
  var self = this;

  this.$imageWrapper.find('.collision-box').remove();
  this.$imageWrapper.find('.interaction-pin').remove();

  if (!this.$image || !this.$image[0].naturalWidth) return;

  var domRect = this.$imageWrapper[0].getBoundingClientRect();
  if (domRect.width === 0) {
    setTimeout(function () {
      self.renderMapData();
    }, 200);
    return;
  }

  var scaleX = domRect.width / this.$image[0].naturalWidth;
  var scaleY = domRect.height / this.$image[0].naturalHeight;

  for (var i = 0; i < this.mapData.walls.length; i++) {
    var box = this.mapData.walls[i];

    var $box = H5PEditor.$('<div>', {
      'class': 'collision-box',
      'data-index': i
    }).css({
      left: (box.x * scaleX) + 'px',
      top: (box.y * scaleY) + 'px',
      width: (box.width * scaleX) + 'px',
      height: (box.height * scaleY) + 'px',
      cursor: 'move'
    }).appendTo(this.$imageWrapper);

    $box.on('mousedown', function (e) {
      if (self.mode !== 'walls') return;
      if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') return;
      if (e.target.classList && e.target.classList.contains('delete-btn')) return;

      e.stopPropagation();
      e.preventDefault();

      self.dragIndex = parseInt(H5PEditor.$(this).attr('data-index'), 10);
      var rect = self.$imageWrapper[0].getBoundingClientRect();
      self.startX = e.clientX - rect.left;
      self.startY = e.clientY - rect.top;

      var boxData = self.mapData.walls[self.dragIndex];
      self.initialBoxX = boxData.x;
      self.initialBoxY = boxData.y;
    });

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
      self.mapData.walls[index].requiredItem = this.value;
      self.save();
    });

    $deleteBtn.on('mousedown', function (e) {
      e.stopPropagation();
      var index = parseInt(H5PEditor.$(this).parent().attr('data-index'), 10);
      self.mapData.walls.splice(index, 1);
      self.save();
      self.renderMapData();
    });
  }

  for (var j = 0; j < this.mapData.points.length; j++) {
    var point = this.mapData.points[j];
    var pinNumber = j + 1;

    var $pin = H5PEditor.$('<div>', {
      'class': 'interaction-pin',
      'data-index': j,
      text: pinNumber
    }).css({
      left: (point.x * scaleX) + 'px',
      top: (point.y * scaleY) + 'px',
      cursor: 'move'
    }).appendTo(this.$imageWrapper);

    $pin.on('mousedown', function (e) {
      if (self.mode !== 'points') return;
      if (e.target.classList && e.target.classList.contains('delete-btn')) return;

      e.stopPropagation();
      e.preventDefault();

      self.dragIndex = parseInt(H5PEditor.$(this).attr('data-index'), 10);
      var rect = self.$imageWrapper[0].getBoundingClientRect();
      self.startX = e.clientX - rect.left;
      self.startY = e.clientY - rect.top;

      var pointData = self.mapData.points[self.dragIndex];
      self.initialBoxX = pointData.x;
      self.initialBoxY = pointData.y;
    });

    var $pinDeleteBtn = H5PEditor.$('<div>', {
      'class': 'delete-btn',
      'text': '×',
      'title': 'Remover Ponto'
    }).appendTo($pin);

    $pinDeleteBtn.on('mousedown', function (e) {
      e.stopPropagation();
      var index = parseInt(H5PEditor.$(this).parent().attr('data-index'), 10);
      self.mapData.points.splice(index, 1);
      self.save();
      self.renderMapData();
    });
  }
};

H5PEditor.PhaserCollisionMap.prototype.save = function () {
  var value = JSON.stringify(this.mapData);
  this.params = value;
  this.setValue(this.field, value);
};

H5PEditor.PhaserCollisionMap.prototype.validate = function () {
  return true;
};

H5PEditor.widgets.phaserCollisionMap = H5PEditor.PhaserCollisionMap;

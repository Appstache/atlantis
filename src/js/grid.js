/*
 * Copyright (C) 2012-2013 InSeven Limited.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
 
(function($) {

  App.Grid = function(device) {
    this.init(device);
  };
  
  App.Grid.Cell = {
    WIDTH:  128,
    HEIGHT: 128,
    MARGIN: 12
  };

  App.Grid.MOVE_THRESHOLD = 10;
  App.Grid.SCROLL_BIAS = 40;

  App.Grid.Margin = {

    TOP: 44,
    LEFT: 10,
    BOTTOM: 20,
    RIGHT: 15,

    Portrait: {
      TOP: 20,
      LEFT: 10,
      RIGHT: 15
    },
    Landscape: {
      TOP: 40,
      LEFT: 64,
      RIGHT: 64
    }
  };

  jQuery.extend(App.Grid.prototype, {

    init: function(device) {
      var self = this;
      self.device = device;
      self.identifier = '#list-games';
      self.element = $(self.identifier);
      self.content = $('#list-games-content');

      self.pageControl = $('#list-games-page-control');
      self.pageItems = [];
      self.items = [];

      self.count = 0;
      self.rows = 0;
      self.width = 0;
      self.pageWidth = 0;
      self.page = 0;

      self.thumbnailQueue = [];

      self.dataSource = {
        'count' : function() { return 0; },
        'titleForIndex': function(index) { return ''; }
      };

      self.delegate = {
        'didSelectItemForRow': function(index, element) {}
      };

      self.touchListener = new App.TouchListener(self.identifier, self);
      self.touchStart = { x: 0, y: 0};
      self.touchStartTimestamp = 0;
      self.touchDidMove = false;
      self.touchCount = 0;

      self.gestureRecognizer = new App.GestureRecognizer();
      self.touchListener.addRecognizer(self.gestureRecognizer);
      
      self.updateLayout();
      $(window).resize(function() {
        self.updateLayout();
      });
      
    },

    // Return the margin for the current orientation.
    margin: function() {
      var self = this;
      if (self.device.orientation === App.Device.Orientation.PORTRAIT) {
        return App.Grid.Margin.Portrait;
      } else {
        return App.Grid.Margin.Landscape;
      }
    },
    
    reloadData: function() {
      var self = this;
      
      self.count = 0;
      self.items = [];
      self.content.html("");
      for (var i=0; i<self.dataSource.count(); i++) {
        var title = self.dataSource.titleForIndex(i);
        self.add(i, title);
      }

      self.updatePageControl();
      self.updatePageItems();
    },
    
    updateLayout: function() {
      var self = this;

      var cellHeight = App.Grid.Cell.HEIGHT + App.Grid.Cell.MARGIN;
      var cellWidth = App.Grid.Cell.WIDTH + App.Grid.Cell.MARGIN;

      var controlWidth = self.element.width() + App.Grid.Cell.MARGIN;
      var controlHeight = self.element.height() + App.Grid.Cell.MARGIN;
      
      var rows = Math.floor(controlHeight / cellHeight);
      var width =  Math.floor(controlWidth / cellWidth);
      // Relayout if required.
      if ((rows != self.rows) || (width != self.width)) {
        self.rows = rows;
        self.width = width;
        self.pageWidth = (self.width * (App.Grid.Cell.WIDTH + App.Grid.Cell.MARGIN)) + self.margin().LEFT + self.margin().RIGHT;
        self.page = 0;
        self.content.css('left', 0);
        self.reloadData();
      }
      
    },

    updatePageControl: function() {
      var self = this;
      
      self.pageControl.html("");
      self.pageItems = [];

      if (self.count === 0) {
        return;
      }

      for (var i = self.minPage(); i < self.maxPage(); i++) {
        var item = $('<div class="page">');
        self.pageControl.append(item);
        self.pageItems.push(item);
      }
    },

    updatePageItems: function() {
      var self = this;

      if (self.count === 0) {
        return;
      }

      for (var i = 0; i < self.pageItems.length; i++) {
        var item = self.pageItems[i];
        if (i === self.page) {
          item.addClass("active");
        } else {
          item.removeClass("active");
        }
      }
    },

    containerWidth: function() {
      var self = this;
      return self.element.width();
    },

    containerHeight: function() {
      var self = this;
      return self.element.height();
    },
    
    add: function(index, title) {
      var self = this;
      
      var columns = Math.floor((self.containerWidth() - App.Grid.Margin.LEFT - App.Grid.Margin.RIGHT) / (App.Grid.Cell.WIDTH + App.Grid.Cell.MARGIN));
      var rows = Math.floor((self.containerHeight() - App.Grid.Margin.TOP - App.Grid.Margin.BOTTOM) / (App.Grid.Cell.HEIGHT + App.Grid.Cell.MARGIN));

      var itemsPerPage = rows * columns;

      var page = Math.floor(self.count / itemsPerPage);
      var indexOnPage = self.count % itemsPerPage;

      var row = Math.floor(indexOnPage / columns);
      var col = indexOnPage % columns;

      var offsetLeft = Math.floor((self.containerWidth() - (((App.Grid.Cell.MARGIN + App.Grid.Cell.WIDTH) * columns) - App.Grid.Cell.MARGIN)) / 2);

      var x = (self.containerWidth() * page) + offsetLeft + ((App.Grid.Cell.WIDTH + App.Grid.Cell.MARGIN) * col);
      var y = App.Grid.Margin.TOP + ((App.Grid.Cell.HEIGHT + App.Grid.Cell.MARGIN) * row);

      var element = self.dataSource.elementForIndex(index);

      var details = {
        'x1': x,
        'y1': y,
        'x2': x + App.Grid.Cell.WIDTH,
        'y2': y + App.Grid.Cell.HEIGHT,
        'element': element
      };
      
      element.css('top', y);
      element.css('left', x);
      element.css('height', App.Grid.Cell.HEIGHT);
      element.css('width', App.Grid.Cell.WIDTH);

      self.items.push(details);

      var gameTitle = $('<div class="game-title">');
      gameTitle.html(title);
      element.append(gameTitle);

      self.dataSource.thumbnail(index, function(thumbnail) {
        if (thumbnail !== undefined) {
          var img = $('<img class="game-thumbnail">');
          img.attr("src", thumbnail);
          element.append(img);
        }
      });

      // Grey out ROMs which are only available online.
      if (window.navigator.onLine === false) {
      }
      
      self.content.append(element);
      self.count += 1;
      
    },

    // Convert a position in container coordinates to content coordinates.
    contentPosition: function(position) {
      var self = this;
      var contentPosition = {
        x: position.x + (self.containerWidth() * self.page),
        y: position.y
      };
      return contentPosition;
    },

    // Determine with which item a touch position intersects.
    // undefined if the touch does not intersect an item.
    itemForPosition: function(position) {
      var self = this;

      var x = position.x + (self.page * self.containerWidth());
      var y = position.y;

      for (var i = 0; i < self.items.length; i++) {
        var item = self.items[i];
        if (x >= item.x1 &&
            x < item.x2 &&
            y >= item.y1 &&
            y < item.y2) {
          return i;
        }
      }

      return undefined;
    },

    elementForIndex: function(index) {
      var self = this;
      var details = self.items[index];
      return details.element;
    },

    minPage: function() {
      var self = this;
      return 0;
    },

    maxPage: function() {
      var self = this;
      var max = Math.ceil(self.count / (self.rows * self.width));
      return max;
    },
    
    // Animate transition to a given page.
    animate: function(page) {
      var self = this;
      self.content.animate({
        'left': -1 * (page * self.containerWidth())
      }, 300, function() {
        self.updatePageItems();
      });
    },

    setPage: function(page) {
      var self = this;
      if (self.page !== page) {
        self.page = page;
        self.animate(self.page);
      }
    },

    // Returns the distance between two points.
    distance: function(a, b) {
      var self = this;
      var x = a.x - b.x;
      var y = a.y - b.y;
      return Math.sqrt(x*x + y*y);
    },

    // Returns the horizontal distance between two points.
    distanceX: function(a, b) {
      var self = this;
      return b.x - a.x;
    },

    // Returns the vertical distance between two points.
    distanceY: function(a, b) {
      var self = this;
      return b.y - a.y;
    },

    // Returns true if the touch event represents a move from the
    // original touchStart position.
    touchIsMove: function(position) {
      var self = this;
      var distance = Math.abs(self.distanceX(self.touchStart, position));
      return (distance >= App.Grid.MOVE_THRESHOLD);
    },

    updateContentPosition: function(position) {
      var self = this;

      var distance = position.x - self.touchStart.x;

      // Scale the offset if necessary.
      var left = distance;
      if (self.page == self.minPage() &&
          left > 0) {
        left = distance / 2;
      } else if (self.page == self.maxPage() &&
                 left < 0) {
        left = distance / 2;
      }

      // Update the position.
      self.content.offset({
        'left': self.offset.left + left,
        'top': self.offset.top
      });

    },

    onTouchEvent: function(state, position, timestamp) {
      var self = this;

      if (state === App.Control.Touch.START) {

        self.offset = self.content.offset();
        self.touchStart = position;
        self.touchDidMove = false;
        self.touchCount = 1;

      } else if (state === App.Control.Touch.MOVE) {
        if (self.touchCount > 0) {

          // Update the move status.
          self.touchDidMove = self.touchDidMove | self.touchIsMove(position);
          if (self.touchDidMove) {
            self.updateContentPosition(position);
          }

        }
      } else if (state === App.Control.Touch.END) {
        if (self.touchCount > 0) {

          // Update the move status.
          self.touchDidMove = self.touchDidMove | self.touchIsMove(position);

          if (self.touchDidMove) {
            // Update the position.
            self.updateContentPosition(position);

            // Work out if we are moving forwards or backwards.
            var page = self.page;
            var distance = self.distanceX(self.touchStart, position);
            if (Math.abs(distance) > ((self.pageWidth / 2) - App.Grid.SCROLL_BIAS)) {
              if (distance > 0) {
                page = page - 1;
              } else {
                page = page + 1;
              }
            }

            // If the user has not made a large enough movement to change the page,
            // check to see if we've matched a swipe gesture before giving up and
            // resetting back to the current the page.
            if (page === self.page) {
              if (self.gestureRecognizer.state === App.GestureRecognizer.State.RECOGNIZED) {
                if (self.gestureRecognizer.direction === App.GestureRecognizer.Direction.RIGHT) {
                  page = page - 1;
                } else if (self.gestureRecognizer.direction === App.GestureRecognizer.Direction.LEFT) {
                  page = page + 1;
                }
              }
            }

            // Animate back to the current page or move to the new page.
            if (page === self.page ||
                page < self.minPage() ||
                page >= self.maxPage()) {
              self.animate(self.page);
            } else {
              self.setPage(page);
            }

            // Reset the gesture recognizer.
            self.gestureRecognizer.reset();

          } else {

            var index = self.itemForPosition(position);
            if (index !== undefined) {
              var element = self.elementForIndex(index);
              self.delegate.didSelectItemForRow(index, element);
            }

          }

          self.touchCount = 0;
        }
      }

    }

  });

})(jQuery);

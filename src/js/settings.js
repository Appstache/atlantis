/*
 * Copyright (C) 2012-2016 InSeven Limited.
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

  App.Settings = function(drive, store, gameBoy) {
    this.init(drive, store, gameBoy);
  };
  
  jQuery.extend(
    App.Settings.prototype, {
      
      init: function(drive, store, gameBoy) {
        var self = this;
        self.drive = drive;
        self.store = store;
        self.gameBoy = gameBoy;
        self.element = $('#screen-settings');
        self.dialog = $('#dialog-settings');
        self.done = new App.Controls.Button('#screen-settings-done', { touchUpInside: function() {
          self.hide();
        }});
        self.scroll = new App.Controls.Scroll('#dialog-settings-body');

        self.element.get(0).addEventListener('touchmove', function(e) {
          e.preventDefault();
        }, false);

        $('#application-version').text(window.config.version);

        self.touchListener = new App.TouchListener('#screen-settings-dismiss', self);

        self.signOut = new App.Controls.Button('#screen-settings-sign-out', { touchUpInside: function() {
          utilities.dispatch(function() {
            if (confirm("Sign out of Google Drive?")) {
              self.drive.signOut().fail(function(e) {
                alert("Unable to sign out of Google Drive.\n" + e);
              });
            }
          });
        }});

        self.sound = new App.Controls.Switch('#switch', function(target, selected) {
          target.setSelected(selected);
          self.store.setProperty(App.Controller.Domain.SETTINGS, App.Store.Property.SOUND, selected);
          self.gameBoy.setSoundEnabled(selected !== 0);
        });

        self.thanks = new App.Controls.Button('#screen-settings-say-thanks', { touchUpInside: function() {
          utilities.open_new_window("https://gameplaycolor.com/thanks/");
        }});

        $("input[name=emulation-speed]:radio").change(function() {
          console.log($(this).val());
          gameboy.setSpeed(parseInt($(this).val()));
        });

        self.speed1 = new App.Controls.Button('#emulation-speed-1x', { touchUpInside: function() {
          gameboy.setSpeed(1);
          $('#emulation-speed-1x').addClass("selected");
          $('#emulation-speed-2x').removeClass("selected");
          $('#emulation-speed-3x').removeClass("selected");
        }});
        self.speed2 = new App.Controls.Button('#emulation-speed-2x', { touchUpInside: function() {
          gameboy.setSpeed(2);
          $('#emulation-speed-1x').removeClass("selected");
          $('#emulation-speed-2x').addClass("selected");
          $('#emulation-speed-3x').removeClass("selected");
        }});
        self.speed3 = new App.Controls.Button('#emulation-speed-3x', { touchUpInside: function() {
          gameboy.setSpeed(3);
          $('#emulation-speed-1x').removeClass("selected");
          $('#emulation-speed-2x').removeClass("selected");
          $('#emulation-speed-3x').addClass("selected");
        }});

        self.store.property(App.Controller.Domain.SETTINGS, App.Store.Property.SOUND, function(sound) {
          if (sound !== undefined) {
            self.sound.setSelected(sound);
            self.gameBoy.setSoundEnabled(sound !== 0);
          } else {
            self.sound.setSelected(1);
            self.gameBoy.setSoundEnabled(true);
          }
        });

      },

      onTouchEvent: function(state, position, timestamp) {
        var self = this;
        if (state == App.Control.Touch.START) {
          self.hide();
        }
      },
      
      hide: function() {
        var self = this;
        self.element.addClass('hidden');
        setTimeout(function() {
          self.element.css('display', 'none');  
        }, 200);
      },
      
      show: function() {
        var self = this;
        self.element.css('display', 'block');
        setTimeout(function() {
          self.element.removeClass('hidden');
        }, 0);
        
      }
      
  });

})(jQuery);

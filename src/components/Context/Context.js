// This component tracks and modifies application data.
// It uses the React Context API.

import React from "react";
import PropTypes from "prop-types";

import Spark from "spark-md5";
import { set, get, del, keys } from "idb-keyval";

import { thumbs, games } from "../../db/gameboy.js";

import { getDataUri, buffersEqual } from "../../utils.js";

import {
  start,
  pause,
  run,
  stop,
  saveState,
  openState,
  GameBoyJoyPadEvent as gameBoyJoyPadEvent,
  GameBoyEmulatorInitialized as gameBoyEmulatorInitialized,
  persistValues
} from "../../cores/GameBoy-Online/index";

const appContext = React.createContext();
const { Provider, Consumer } = appContext;

const getThumbUri = async title => {
  const processUri = uri => {
    if (!uri && !navigator.onLine) {
      return `reattempt`;
    } else if (!uri) {
      return false;
    }

    return uri;
  };

  const thumbUri = processUri(
    await getDataUri(thumbs.dmg.replace(`%s`, encodeURIComponent(title)))
  );

  if (typeof thumbUri === `string`) {
    return thumbUri;
  }

  return getDataUri(thumbs.cgb.replace(`%s`, encodeURIComponent(title)));
};

const thumbIsUri = thumb => thumb !== false && thumb !== `reattempt`;

let state;
let dispatch;

const actions = {};

const reducer = (state, action) => {
  if (!actions[action.type]) {
    console.error(`Invalid Action:`, action);
    return;
  }

  const newState = { ...state, ...action };
  delete newState.type;

  return newState;
};

const action = (type, callback) => {
  actions[type] = callback;

  const blitspatch = payload => {
    dispatch({
      type,
      ...payload
    });
  };

  return (...args) => callback(state, blitspatch, ...args);
};

const Context = ({ children, initialState, restoreCoreData }) => {
  [state, dispatch] = React.useReducer(reducer, initialState);

  const oldActions = {
    toggleDrawer: drawerName => () => {
      this.setState(
        prevState => ({
          [`${drawerName}Open`]: !prevState[`${drawerName}Open`]
        }),

        () => {
          if (!gameBoyEmulatorInitialized()) {
            return;
          }

          if (this.state[`${drawerName}Open`]) {
            pause();
          } else {
            run();
          }
        }
      );
    },

    uploadGame: e => {
      const getROM = file =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();

          const buffer = new Spark.ArrayBuffer();

          reader.onload = () => {
            this.actions.unzip(reader.result).then(rom => {
              buffer.append(rom);

              if (buffer._length && rom.byteLength) {
                const md5 = buffer.end().toUpperCase();

                for (const { md5: libMd5 } of this.state.library) {
                  if (md5 === libMd5) {
                    return;
                  }
                }

                const romData = {
                  title: games[md5] || file.name.replace(/\.zip/gu, ``),
                  md5,
                  rom: reader.result
                };

                getThumbUri(romData.title).then(uri => {
                  romData.thumb = uri;

                  resolve(romData);
                });
              }
            });
          };

          reader.onerror = err => {
            reject(err);
          };

          reader.readAsArrayBuffer(file);
        });

      const roms = [];

      for (const file of e.target.files) {
        roms.push(getROM(file));
      }

      Promise.all(roms).then(results => {
        this.actions.addToLibrary(results, () => {
          set(`games`, this.state.library);
        });
      });
    },

    deleteGame: rom => {
      let deletedGame = null;

      let { currentROM } = this.state;

      if (buffersEqual(currentROM, rom)) {
        currentROM = null;
        stop();
      }

      this.setState(
        prevState => ({
          library: prevState.library.filter(game => {
            if (buffersEqual(game.rom, rom)) {
              deletedGame = game;
              return false;
            }

            return true;
          }),
          currentROM
        }),

        () => {
          if (this.state.library.length) {
            set(`games`, this.state.library);
          } else {
            del(`games`);
          }

          if (!this.state.currentROM) {
            del(`currentROM`);
          }
        }
      );

      this.actions.deleteSRAM(deletedGame.name);
      this.actions.deleteSaveState(deletedGame.name, `main`);
      this.actions.deleteSaveState(deletedGame.name, `auto`);
    },

    deleteSRAM: async name => {
      const dataKeys = await keys();

      for (const key of dataKeys) {
        if (key === `SRAM_${name}`) {
          del(key);
          delete persistValues[key];
        }
      }
    },

    deleteSaveState: async (name, slot) => {
      const dataKeys = await keys();

      for (const key of dataKeys) {
        if (key === `FREEZE_${name}_${slot}`) {
          del(key);
          delete persistValues[key];
        }
      }
    },

    retryThumbs: (library, force) => {
      // If we aren't forcing an update and don't need to do one, then don't.
      if (!force && !library.some(game => game.thumb === `reattempt`)) {
        return false;
      }

      // Create retries from given library.
      const retries = library.map(
        game =>
          new Promise(resolve => {
            // If we're forcing an update or game is marked for it.
            if (force || game.thumb === `reattempt`) {
              getThumbUri(game.title).then(thumb => {
                // If game's thumb is valid, but the network's isn't, don't update.
                if (thumbIsUri(game.thumb) && !thumbIsUri(thumb)) {
                  resolve(game);
                  return;
                }

                // If the game's thumb isn't valid or the network has a valid
                // replacement, update the thumb.
                if (
                  !thumbIsUri(game.thumb) ||
                  (thumbIsUri(game.thumb) && thumbIsUri(thumb))
                ) {
                  game.thumb = thumb;
                }

                resolve(game);
              });
            } else {
              resolve(game);
            }
          })
      );

      // Fetch all applicable thumbs, then replace library in context and IDB.
      Promise.all(retries).then(updatedLibrary => {
        this.setState(
          { library: updatedLibrary },

          () => {
            set(`games`, this.state.library);
          }
        );
      });
    },

    toggleTurbo: () => {
      this.setState(prevState => ({ turbo: !prevState.turbo }));
    },

    saveState: () => {
      saveState(`main`);
      this.actions.showMessage(`Saved state.`);
    },

    loadState: async () => {
      const stringROM = await this.actions.getBinaryString(
        this.state.currentROM
      );
      openState(`main`, this.state.canvas.current, stringROM);
      this.actions.showMessage(`Loaded state.`);
    },

    abss: () => {
      const buttonCodes = {
        START: 7,
        SELECT: 6,
        A: 4,
        B: 5
      };

      for (const [, code] of Object.entries(buttonCodes)) {
        gameBoyJoyPadEvent(code, `pressed`);
      }

      const PRESSTIME = 500;
      setTimeout(() => {
        for (const [, code] of Object.entries(buttonCodes)) {
          gameBoyJoyPadEvent(code);
        }
      }, PRESSTIME);
    },

    reset: async () => {
      const stringROM = await this.actions.getBinaryString(
        this.state.currentROM
      );
      start(
        this.state.canvas.current,
        new Uint8Array(this.state.currentROM),
        stringROM
      );
    },

    showMessage: message => {
      this.setState({ message });
    },

    hideMessage: () => {
      this.setState({ message: `` });
    }
  };

  React.useEffect(() => {
    restoreCoreData().then(() => {
      // Hydrate settings.
      get(`settings`).then((savedSettings = {}) => {
        actions.setSavedSettings(savedSettings);
      });
      // Reattempt thumb downloads that could not be completed while offline.
      get(`games`).then((library = []) => {
        this.actions.retryThumbs(library);
      });
      // Load last-played game.
      get(`currentROM`).then(currentROM => {
        if (currentROM) {
          this.actions.setCurrentROM(currentROM, `autoLoad`);
        }
      });
    });
  });

  return <Provider value={state}>{children}</Provider>;
};

Context.propTypes = {
  children: PropTypes.element.isRequired,
  restoreCoreData: PropTypes.func.isRequired
};

export default Context;

export { Consumer, appContext, action };

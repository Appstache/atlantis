import React from 'react';
import PropTypes from 'prop-types';

import { styleInternalClock } from './InternalClockStyles';

import {
  Drawer,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button
} from '@material-ui/core';

import { gameboy } from '../../cores/GameBoy-Online/index';

const ZERO = 0;

const fields = [
  {
    name: `days`,
    label: `Days`,
    value: 512
  },
  {
    name: `hours`,
    label: `Hours`,
    value: 24
  },
  {
    name: `minutes`,
    label: `Minutes`,
    value: 60
  },
  {
    name: `seconds`,
    label: `Seconds`,
    value: 60
  }
];

class InternalClock extends React.Component {
  constructor(props) {
    super(props);

    this.state = { time: {} };

    this.changeClock = (unit)=> (e)=> {
      const time = {
        days: gameboy.RTCDays | ZERO || ZERO,
        hours: gameboy.RTCHours | ZERO || ZERO,
        minutes: gameboy.RTCMinutes | ZERO || ZERO,
        seconds: gameboy.RTCSeconds | ZERO || ZERO,
        [unit]: e.target.value
      };

      gameboy.clockUpdate(time);

      this.setState({ time });
    };
  }

  render() {
    if(!gameboy) {
      return null;
    }

    const { classes, handleDone } = this.props;

    return (
      <Drawer
        anchor="bottom"
        classes={{ paper: classes.paper }}
        open={this.props.open}
      >
        {fields.map((field)=> (
          <FormControl key={field.name}>
            <InputLabel htmlFor={`quick-menu-clock-${field.name}`}>
              {field.label}
            </InputLabel>
            <Select
              inputProps={{
                name: `quick-menu-clock-${field.name}`,
                id: `quick-menu-clock-${field.name}`
              }}
              onChange={this.changeClock(field.name)}
              value={this.state.time[field.name] || gameboy[`RTC${field.label}`] | ZERO || ZERO}
            >
              {Array(field.value).fill(ZERO).map((zero, val)=>
                (<MenuItem key={`${field.name}${zero + val}`} value={val}>
                  {val}
                </MenuItem>)
              )}
            </Select>
          </FormControl>
        ))}
        <Button className={classes.done} onClick={handleDone}>
          {`Done`}
        </Button>
      </Drawer>
    );
  }
}

InternalClock.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  open: PropTypes.bool,
  handleDone: PropTypes.func.isRequired
};

InternalClock.defaultProps = { open: false };

export default styleInternalClock(InternalClock);
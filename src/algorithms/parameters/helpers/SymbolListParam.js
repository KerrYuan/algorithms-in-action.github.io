/* eslint-disable react/prop-types */
/* eslint-disable no-prototype-builtins */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React from 'react';
import ControlButton from '../../../components/common/ControlButton';
import '../../../styles/Param.scss';
import { ReactComponent as RefreshIcon } from '../../../assets/icons/refresh.svg';
import { GlobalActions } from '../../../context/actions';
import ParamForm from './ParamForm';
import { genRandNumList } from './InputBuilders';
import { commaSeparatedNumberListValidCheck } from './InputValidators';
import { errorParamMsg } from './ParamMsg';


import useParam from '../../../context/useParam';


/**
 * This symbol list param component can be used when
 * the param input accepts a list of numbers with 
 * symbols (-, /) in front of them.
 */

function SymbolListParam({
   name, buttonName, mode, DEFAULT_VAL, SET_VAL, REFRESH_FUNCTION, ALGORITHM_NAME,
  EXAMPLE, formClassName, handleSubmit, setMessage
}) {
    const{
        dispatch,
        disabled, 
        //paramVal,
        //setParamVal,
        
    }   = useParam(DEFAULT_VAL);
    // Split default submit operations, convert argument into one 
    // node first 

    const handleSymbolSubmit = (e) => {
        e.preventDefault();
        const inputValue = e.target[0].value.replace(/\s+/g, '');
        const tokens = inputValue.split(',');
        const operations = [];

        for (const token of tokens){
            // Prevent empty inputs
            if(token === ''){
                setMessage(`Invalid input: ${token}. Input cannot be empty!`);
                return;
            }
            
            // Detect search operations 
            if(token.startsWith('?')){
                const valueString = token.substring(1);

                // Check for a valid search value
                if(!/^-?\d+$/.test(valueString)){
                    setMessage(`Invalid input: ${token}. Can't do a search with this!`);
                    return;
                }

                // Push search value
                operations.push({ type: 'search', value: parseInt(valueString, 10) });
            } else{
                if(!/^-?\d+$/.test(token)){
                    setMessage(`Invalid input: ${token}. Can't build a tree with this!`);
                    return;
                }
                // Push insertion value
                operations.push({ type: 'insert', value: parseInt(token, 10) });
            }
        }
        dispatch(GlobalActions.RUN_ALGORITHM, {name, mode, operations});
        setMessage(null);
    };

    return(
    <ParamForm
      formClassName={formClassName}
      name={ALGORITHM_NAME}
      buttonName={buttonName}
      value={DEFAULT_VAL}
      disabled={disabled}
      onChange={(e) => {
        // console.log(e.target.value);
        // console.log(e.target.value.split(','));
        SET_VAL(e.target.value.split(','));
      }}
      // If no customized handle function is provided, the default one will be used
      handleSubmit={
        handleSubmit && typeof handleSubmit === 'function'
          ? handleSubmit
          : handleSymbolSubmit
      }
    >
      <ControlButton
        icon={<RefreshIcon />}
        className={disabled ? 'greyRoundBtnDisabled' : 'greyRoundBtn'}
        id={ALGORITHM_NAME}
        disabled={disabled}
        onClick={() => {
          // console.log(DEFAULT_VAL);
          let list = genRandNumList(DEFAULT_VAL.length, 1, 100);

          if (REFRESH_FUNCTION !== undefined) {
            // refresh function is simply a function that returns a list, in whatever sorted (or random) order as desired
            list = REFRESH_FUNCTION();
          }
          setMessage(null);
          SET_VAL(list);
        }}
      />
    </ParamForm>
        
    )
}

export default SymbolListParam;


/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import {
	ValidationInputError,
	useValidationContext,
} from '@woocommerce/base-context';
import { withInstanceId } from '@woocommerce/base-hocs/with-instance-id';

/**
 * Internal dependencies
 */
import TextInput from './text-input';
import './style.scss';

const ValidatedTextInput = ( {
	className,
	instanceId,
	id,
	ariaDescribedBy,
	errorId,
	validateOnMount = true,
	focusOnMount = false,
	onChange,
	showError = true,
	customValidation = null,
	...rest
} ) => {
	const [ isPristine, setIsPristine ] = useState( true );
	const inputRef = useRef();
	const {
		getValidationError,
		hideValidationError,
		setValidationErrors,
		clearValidationError,
		getValidationErrorId,
	} = useValidationContext();

	const textInputId = id || 'textinput-' + instanceId;
	errorId = errorId || textInputId;
	const errorMessage = useMemo( () => getValidationError( errorId ) || {}, [
		getValidationError,
		errorId,
	] );

	const validateInput = useCallback(
		( errorsHidden = true ) => {
			const inputObject = inputRef.current || null;
			if ( ! inputObject ) {
				return;
			}
			// Trim white space before validation.
			inputObject.value = inputObject.value.trim();
			let inputIsValid = inputObject.checkValidity();

			if ( typeof customValidation === 'function' ) {
				inputIsValid = customValidation( inputObject.value );
			}

			if ( inputIsValid ) {
				clearValidationError( errorId );
			} else {
				setValidationErrors( {
					[ errorId ]: {
						message:
							inputObject.validationMessage ||
							errorMessage ||
							__(
								'Invalid value.',
								'woo-gutenberg-products-block'
							),
						hidden: errorsHidden,
					},
				} );
			}
		},
		[
			clearValidationError,
			customValidation,
			errorId,
			errorMessage,
			setValidationErrors,
		]
	);

	useEffect( () => {
		if ( isPristine ) {
			if ( focusOnMount ) {
				inputRef.current.focus();
			}
			setIsPristine( false );
		}
	}, [ focusOnMount, isPristine, setIsPristine ] );

	useEffect( () => {
		if ( isPristine ) {
			if ( validateOnMount ) {
				validateInput();
			}
			setIsPristine( false );
		}
	}, [ isPristine, setIsPristine, validateOnMount, validateInput ] );

	// Remove validation errors when unmounted.
	useEffect( () => {
		return () => {
			clearValidationError( errorId );
		};
	}, [ clearValidationError, errorId ] );

	const hasError = errorMessage.message && ! errorMessage.hidden;
	const describedBy =
		showError && hasError && getValidationErrorId( errorId )
			? getValidationErrorId( errorId )
			: ariaDescribedBy;

	return (
		<TextInput
			className={ classnames( className, {
				'has-error': hasError,
			} ) }
			id={ textInputId }
			onBlur={ () => {
				validateInput( false );
			} }
			feedback={
				showError && <ValidationInputError propertyName={ errorId } />
			}
			ref={ inputRef }
			onChange={ ( val ) => {
				hideValidationError( errorId );
				onChange( val );
			} }
			ariaDescribedBy={ describedBy }
			{ ...rest }
		/>
	);
};

ValidatedTextInput.propTypes = {
	onChange: PropTypes.func.isRequired,
	id: PropTypes.string,
	value: PropTypes.string,
	ariaDescribedBy: PropTypes.string,
	errorId: PropTypes.string,
	validateOnMount: PropTypes.bool,
	focusOnMount: PropTypes.bool,
	showError: PropTypes.bool,
	customValidation: PropTypes.func,
};

export default withInstanceId( ValidatedTextInput );

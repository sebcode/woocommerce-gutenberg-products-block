/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import triggerFetch from '@wordpress/api-fetch';
import {
	useEffect,
	useRef,
	useCallback,
	useState,
	useMemo,
} from '@wordpress/element';
import { useStoreCart, useStoreNotices } from '@woocommerce/base-hooks';
import { formatStoreApiErrorMessage } from '@woocommerce/base-utils';

/**
 * Internal dependencies
 */
import { preparePaymentData } from './utils';
import { useShippingDataContext } from '../../shipping';
import { useCustomerDataContext } from '../../customer';
import { usePaymentMethodDataContext } from '../../payment-methods';
import { useValidationContext } from '../../../shared';
import {
	useCheckoutContext,
	setHasError,
	setCustomerId,
	setAfterProcessing,
} from '../../checkout-state';

/**
 * CheckoutProcessor component.
 *
 * @todo Needs to consume all contexts.
 *
 * Subscribes to checkout context and triggers processing via the API.
 */
const CheckoutProcessor = () => {
	const {
		hasError: checkoutHasError,
		onCheckoutBeforeProcessing,
		dispatch: checkoutContextDispatch,
		redirectUrl,
		isProcessing: checkoutIsProcessing,
		isBeforeProcessing: checkoutIsBeforeProcessing,
		isComplete: checkoutIsComplete,
		orderNotes,
		shouldCreateAccount,
	} = useCheckoutContext();
	const { hasValidationErrors } = useValidationContext();
	const { shippingErrorStatus } = useShippingDataContext();
	const { billingData, shippingAddress } = useCustomerDataContext();
	const { cartNeedsPayment, receiveCart } = useStoreCart();
	const {
		activePaymentMethod,
		currentStatus: currentPaymentStatus,
		paymentMethodData,
		expressPaymentMethods,
		paymentMethods,
		shouldSavePayment,
	} = usePaymentMethodDataContext();
	const { addErrorNotice, removeNotice, setIsSuppressed } = useStoreNotices();
	const currentBillingData = useRef( billingData );
	const currentShippingAddress = useRef( shippingAddress );
	const currentRedirectUrl = useRef( redirectUrl );
	const [ isProcessingOrder, setIsProcessingOrder ] = useState( false );
	const expressPaymentMethodActive = Object.keys(
		expressPaymentMethods
	).includes( activePaymentMethod );

	const paymentMethodId = useMemo( () => {
		const merged = { ...expressPaymentMethods, ...paymentMethods };
		return merged?.[ activePaymentMethod ]?.paymentMethodId;
	}, [ activePaymentMethod, expressPaymentMethods, paymentMethods ] );

	const checkoutWillHaveError =
		( hasValidationErrors && ! expressPaymentMethodActive ) ||
		currentPaymentStatus.hasError ||
		shippingErrorStatus.hasError;

	// If express payment method is active, let's suppress notices
	useEffect( () => {
		setIsSuppressed( expressPaymentMethodActive );
	}, [ expressPaymentMethodActive, setIsSuppressed ] );

	useEffect( () => {
		if (
			checkoutWillHaveError !== checkoutHasError &&
			( checkoutIsProcessing || checkoutIsBeforeProcessing ) &&
			! expressPaymentMethodActive
		) {
			setHasError( checkoutContextDispatch, checkoutWillHaveError );
		}
	}, [
		checkoutWillHaveError,
		checkoutHasError,
		checkoutIsProcessing,
		checkoutIsBeforeProcessing,
		expressPaymentMethodActive,
		checkoutContextDispatch,
	] );

	const paidAndWithoutErrors =
		! checkoutHasError &&
		! checkoutWillHaveError &&
		( currentPaymentStatus.isSuccessful || ! cartNeedsPayment ) &&
		checkoutIsProcessing;

	useEffect( () => {
		currentBillingData.current = billingData;
		currentShippingAddress.current = shippingAddress;
		currentRedirectUrl.current = redirectUrl;
	}, [ billingData, shippingAddress, redirectUrl ] );

	const checkValidation = useCallback( () => {
		if ( hasValidationErrors ) {
			return {
				errorMessage: __(
					'Some input fields are invalid.',
					'woo-gutenberg-products-block'
				),
			};
		}
		if ( currentPaymentStatus.hasError ) {
			return {
				errorMessage: __(
					'There was a problem with your payment option.',
					'woo-gutenberg-products-block'
				),
			};
		}
		if ( shippingErrorStatus.hasError ) {
			return {
				errorMessage: __(
					'There was a problem with your shipping option.',
					'woo-gutenberg-products-block'
				),
			};
		}

		return true;
	}, [
		hasValidationErrors,
		currentPaymentStatus.hasError,
		shippingErrorStatus.hasError,
	] );

	useEffect( () => {
		let unsubscribeProcessing;
		if ( ! expressPaymentMethodActive ) {
			unsubscribeProcessing = onCheckoutBeforeProcessing(
				checkValidation,
				0
			);
		}
		return () => {
			if ( ! expressPaymentMethodActive ) {
				unsubscribeProcessing();
			}
		};
	}, [
		onCheckoutBeforeProcessing,
		checkValidation,
		expressPaymentMethodActive,
	] );

	const processOrder = useCallback( () => {
		setIsProcessingOrder( true );
		removeNotice( 'checkout' );
		let data = {
			billing_address: currentBillingData.current,
			shipping_address: currentShippingAddress.current,
			customer_note: orderNotes,
			should_create_account: shouldCreateAccount,
		};
		if ( cartNeedsPayment ) {
			data = {
				...data,
				payment_method: paymentMethodId,
				payment_data: preparePaymentData(
					paymentMethodData,
					shouldSavePayment,
					activePaymentMethod
				),
			};
		}
		triggerFetch( {
			path: '/wc/store/checkout',
			method: 'POST',
			data,
			cache: 'no-store',
			parse: false,
		} )
			.then( ( fetchResponse ) => {
				// Update nonce.
				triggerFetch.setNonce( fetchResponse.headers );

				// Update user using headers.
				setCustomerId(
					checkoutContextDispatch,
					parseInt(
						fetchResponse.headers.get( 'X-WC-Store-API-User' ),
						10
					)
				);

				// Handle response.
				fetchResponse.json().then( function ( response ) {
					if ( ! fetchResponse.ok ) {
						// We received an error response.
						addErrorNotice(
							formatStoreApiErrorMessage( response ),
							{
								id: 'checkout',
							}
						);
						setHasError( checkoutContextDispatch );
					}
					setAfterProcessing( checkoutContextDispatch, response );
					setIsProcessingOrder( false );
				} );
			} )
			.catch( ( errorResponse ) => {
				// Update nonce.
				triggerFetch.setNonce( errorResponse.headers );

				// If new customer ID returned, update the store.
				if ( errorResponse.headers?.get( 'X-WC-Store-API-User' ) ) {
					setCustomerId(
						checkoutContextDispatch,
						parseInt(
							errorResponse.headers.get( 'X-WC-Store-API-User' ),
							10
						)
					);
				}

				errorResponse.json().then( function ( response ) {
					// If updated cart state was returned, update the store.
					if ( response.data?.cart ) {
						receiveCart( response.data.cart );
					}
					addErrorNotice( formatStoreApiErrorMessage( response ), {
						id: 'checkout',
					} );

					response.additional_errors?.forEach?.(
						( additionalError ) => {
							addErrorNotice( additionalError.message, {
								id: additionalError.error_code,
							} );
						}
					);

					setHasError( checkoutContextDispatch );
					setAfterProcessing( checkoutContextDispatch, response );
					setIsProcessingOrder( false );
				} );
			} );
	}, [
		addErrorNotice,
		removeNotice,
		paymentMethodId,
		activePaymentMethod,
		paymentMethodData,
		shouldSavePayment,
		cartNeedsPayment,
		receiveCart,
		checkoutContextDispatch,
		orderNotes,
		shouldCreateAccount,
	] );
	// redirect when checkout is complete and there is a redirect url.
	useEffect( () => {
		if ( currentRedirectUrl.current ) {
			window.location.href = currentRedirectUrl.current;
		}
	}, [ checkoutIsComplete ] );

	// process order if conditions are good.
	useEffect( () => {
		if ( paidAndWithoutErrors && ! isProcessingOrder ) {
			processOrder();
		}
	}, [ processOrder, paidAndWithoutErrors, isProcessingOrder ] );

	return null;
};

export default CheckoutProcessor;

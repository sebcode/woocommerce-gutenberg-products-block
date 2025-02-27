# Block Script Assets

[Block Types](https://github.com/woocommerce/woocommerce-gutenberg-products-block/tree/trunk/src/BlockTypes) are often responsible for enqueuing script assets that make blocks functional on both the front-end and within the editor. Additionally, some block scripts require extra data from the server and thus have extra dependencies that need to be loaded.

For performance reasons the blocks plugin ensures assets and asset data is made available only as needed.

## When are assets needed?

Assets are needed when we know a block will be rendered.

In the context of [Block Types](https://github.com/woocommerce/woocommerce-gutenberg-products-block/tree/trunk/src/BlockTypes), assets and asset data is enqueued within the block `render()` method.

In an admin editor context we must also ensure asset _data_ is available when the `enqueue_block_editor_assets` hook is fired. That is because block scripts are enqueued ready for the Block Inserter, but the block may not be rendered.

Note: `enqueue_block_editor_assets` fires regardless of whether or not a block has been rendered in the editor context, so unless handled correctly, block data may be loaded twice. The `AbstractBlock` class below handles this for you, or you can track whether or not assets have been loaded already with a class variable.

## Using the `AbstractBlock` class

The [`AbstractBlock` class](https://github.com/woocommerce/woocommerce-gutenberg-products-block/blob/trunk/src/BlockTypes/AbstractBlock.php) has some helper methods to make asset management easier. Most Block Types in this plugin extend this class.

### AbstractBlock::render

The default `render` method will call `AbstractBlock::enqueue_assets`—this ensures both scripts and asset data is ready once the block is rendered.

### AbstractBlock::enqueue_editor_assets

This method is hooked into `enqueue_block_editor_assets`. If assets have not already loaded, it calls `AbstractBlock::enqueue_data` to ensure data dependencies exist ready for the Block Editor.

### AbstractBlock::enqueue_assets

If assets have not already been loaded, this method calls `enqueue_data` and `enqueue_scripts`.

Classes which extend `AbstractBlock` should override `enqueue_data` and `enqueue_scripts` to handle their specific assets.

### AbstractBlock::enqueue_data

If extending `AbstractBlock` this method can be overridden. It should enqueue/register asset data used by the block.

```php
protected function enqueue_data( array $attributes = [] ) {
    $data_registry = Automattic\WooCommerce\Blocks\Package::container()->get(
        Automattic\WooCommerce\Blocks\Assets\AssetDataRegistry::class
    );
    $data_registry->add( 'some-asset-data', 'data-value' );
}
```

## woocommerce_shared_settings deprecated filter

This filter was used as a workaround. Currently the best way to achieve data registration comes from using AssetsDataRegistry:

```php
	Automattic\WooCommerce\Blocks\Package::container()
		->get( Automattic\WooCommerce\Blocks\Assets\AssetDataRegistry::class )
		->add( $key, $value );
```

On the client side the value will be available via:

```js
wc.wcSettings.getSetting( 'key' );
```

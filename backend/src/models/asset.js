const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
	game: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Game',
		required: true
	},
	gameAccount: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'GameAccount',
		required: true
	},
	name: {
		type: String,
		required: true,
		trim: true
	},
	quantity: {
		type: Number,
		required: true
	},
	blockchainAssetId: {
		type: Number,
		required: true,
		min: 1,
		validate: {
			validator: Number.isSafeInteger,
			message: 'blockchainAssetId must be a positive safe integer'
		}
	},
	creationTransactionHash: {
		type: String,
		trim: true
	},
	statusTransactionHash: {
		type: String,
		trim: true
	},
	active: {
		type: Boolean,
		default: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date
	}
});

AssetSchema.statics.ensureBlockchainAssetIdIndex = async function () {
	const missingIds = await this.countDocuments({
		$or: [
			{ blockchainAssetId: { $exists: false } },
			{ blockchainAssetId: null }
		]
	});

	if (missingIds > 0) {
		throw new Error(
			`Cannot create the unique blockchainAssetId index; ${missingIds} historical records have a missing or null blockchainAssetId`
		);
	}

	const duplicateIds = await this.aggregate([
		{
			$group: {
				_id: '$blockchainAssetId',
				count: { $sum: 1 }
			}
		},
		{
			$match: {
				count: { $gt: 1 }
			}
		},
		{
			$sort: { _id: 1 }
		}
	]);

	if (duplicateIds.length > 0) {
		const details = duplicateIds
			.map(duplicate => `${duplicate._id} (${duplicate.count} records)`)
			.join(', ');
		throw new Error(
			`Cannot create the unique blockchainAssetId index; duplicate records exist: ${details}`
		);
	}

	let indexes;
	try {
		indexes = await this.collection.indexes();
	} catch (error) {
		if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') {
			throw error;
		}

		indexes = [];
	}
	const existingIndex = indexes.find(index =>
		index.key &&
		index.key.blockchainAssetId === 1 &&
		Object.keys(index.key).length === 1
	);

	if (existingIndex && !existingIndex.unique) {
		throw new Error(
			`Cannot create the unique blockchainAssetId index because non-unique index "${existingIndex.name}" already exists`
		);
	}

	if (
		existingIndex &&
		(existingIndex.sparse || existingIndex.partialFilterExpression)
	) {
		throw new Error(
			`Cannot use index "${existingIndex.name}" because sparse or partial uniqueness would not protect every asset`
		);
	}

	if (!existingIndex) {
		await this.collection.createIndex(
			{ blockchainAssetId: 1 },
			{ unique: true, name: 'blockchainAssetId_unique' }
		);
	}
};

const Asset = mongoose.model('Asset', AssetSchema);

module.exports = Asset;

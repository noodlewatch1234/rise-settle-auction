function calculateAllocation(
  deposit: any,
  auctionPrice: any,
  supplyForSale: any,
  numberOfBidders: any
) {
  return Math.floor(
    Math.min(deposit / auctionPrice, supplyForSale / numberOfBidders)
  );
}

interface AuctionBid {
  maxPrice: BigInt | number;
  depositAmount: BigInt | number;
  bidder: `0x${string}`;
  tokensWon: number;
  refundAmount: BigInt | number;
  fullyAllocated?: boolean;
}

const riseBurnerAddress = "0x38994C616DA41B0aE7183ed0DbD370dC85c5565A";

export const settleAuctionOffChain = async (
  auctionBids_: AuctionBid[],
  supplyForSale: number,
  marketPrice_: string
) => {
  let totalDepositAmounts = 0;
  let totalDepositOfQualifyingBids = 0;
  let discount = 0.97;

  const tempAuctionBids = removeDuplicates(auctionBids_);

  //This sets the final price to start at 80% of the auction supply value
  //This is essentially the burn contract address bidding
  //And another unsold RISE will be allocated to this address to get burned
  const auctionBids = modifyFinalAuctionPrice(
    tempAuctionBids,
    marketPrice_,
    supplyForSale
  );

  for (const bid of auctionBids) {
    if (Number(bid.depositAmount.toString()) > 0) {
      totalDepositAmounts += Number(bid.depositAmount.toString());
    }
  }

  //intermFinalPrice is in wei, dont let the number fool you
  const interimFinalPrice = totalDepositAmounts / supplyForSale;
  const finalMarketPrice = Math.min(
    interimFinalPrice,
    Number(marketPrice_.toString())
  );

  for (const bid of auctionBids) {
    if (
      Number(bid.maxPrice.toString()) >= finalMarketPrice &&
      Number(bid.depositAmount.toString()) > 0
    ) {
      totalDepositOfQualifyingBids += Number(bid.depositAmount.toString());
    } else {
      bid.refundAmount = Number(bid.depositAmount.toString());
      bid.depositAmount = 0;
      bid.tokensWon = 0;
      bid.fullyAllocated = true;
    }
  }

  if (totalDepositOfQualifyingBids / supplyForSale > finalMarketPrice) {
    discount = discount;
  } else {
    discount = 1;
  }

  const finalAuctionPrice =
    finalMarketPrice != 0
      ? Math.floor(
          discount *
            Math.min(
              totalDepositOfQualifyingBids / supplyForSale,
              finalMarketPrice
            )
        )
      : Math.floor(totalDepositOfQualifyingBids / supplyForSale);

  if (finalAuctionPrice == 0) {
    for (const bid of auctionBids) {
      if (Number(bid.maxPrice.toString()) < finalAuctionPrice) {
        bid.refundAmount = Number(bid.depositAmount.toString());
        bid.depositAmount = 0;
        bid.tokensWon = 0;
        bid.fullyAllocated = true;
      }
    }
  }

  let supplyAllocated = 0;
  let remainingSupply = supplyForSale;

  for (let bid of auctionBids) {
    if (
      supplyAllocated < supplyForSale &&
      Number(bid.depositAmount.toString()) > 0
    ) {
      let amountAllocated = calculateAllocation(
        Number(bid.depositAmount.toString()),
        finalAuctionPrice,
        supplyForSale,
        auctionBids.filter(
          (bid: any) => Number(bid.depositAmount.toString()) > 0
        ).length
      );
      remainingSupply -= amountAllocated;
      supplyAllocated += amountAllocated;
      bid.tokensWon = amountAllocated;

      let excessDeposit =
        Number(bid.depositAmount.toString()) -
        amountAllocated * finalAuctionPrice;
      //refundAmount is in the unit of wei
      bid.refundAmount = excessDeposit > 0 ? excessDeposit : 0;

      bid.fullyAllocated =
        bid.refundAmount < finalAuctionPrice ||
        bid.tokensWon == 0 ||
        remainingSupply == 0
          ? true
          : false;
    }
  }
  let totalReallocated = 0;
  while (remainingSupply > 0) {
    const qualifyingBids = auctionBids.filter(
      (bid: any) => bid.fullyAllocated != true
    );

    if (qualifyingBids.length === 0) {
      break;
    }

    for (let bid of qualifyingBids) {
      const previousAllocation = Number(bid.tokensWon) * finalAuctionPrice;
      const additionalTokenRequirement =
        (Number(bid.depositAmount.toString()) - previousAllocation) /
        finalAuctionPrice;
      const fairShareAllocation = remainingSupply / qualifyingBids.length;
      const additonalTokenReallocation = Math.floor(
        Math.min(additionalTokenRequirement, fairShareAllocation)
      );

      if (additonalTokenReallocation <= 0) {
        bid.fullyAllocated = true; // Mark bid as fully allocated to exclude in next iteration
        continue;
      }

      remainingSupply -= additonalTokenReallocation;

      bid.tokensWon += additonalTokenReallocation;

      totalReallocated += additonalTokenReallocation;

      let excessDeposit =
        Number(bid.depositAmount.toString()) -
        //@ts-ignore
        bid.tokensWon * finalAuctionPrice;

      //refundAmount is in the unit of wei
      bid.refundAmount = excessDeposit > 0 ? excessDeposit : 0;
      if (additonalTokenReallocation == additionalTokenRequirement) {
        bid.fullyAllocated = true;
      }
    }
  }

  //Makes sure the price modifier does not get any eth.
  return auctionBids.map((item) => {
    if (item.bidder === riseBurnerAddress) {
      item.refundAmount = 0;
      item.depositAmount = 0;
      item.maxPrice = 0;
    }
    return item;
  });
};

function removeDuplicates(bids: AuctionBid[]): AuctionBid[] {
  const uniqueBids: AuctionBid[] = [];
  const encounteredBidders: { [bidder: string]: AuctionBid } = {};

  bids.forEach((bid) => {
    const currentBid = encounteredBidders[bid.bidder];
    if (currentBid) {
      // If current depositAmount is not 0 and (stored one is 0 or current maxPrice is higher),
      // or maxPrice is the same and current depositAmount is larger, replace
      if (
        (bid.depositAmount !== 0n && currentBid.depositAmount === 0n) ||
        bid.maxPrice > currentBid.maxPrice ||
        (bid.maxPrice === currentBid.maxPrice &&
          bid.depositAmount > currentBid.depositAmount)
      ) {
        const index = uniqueBids.findIndex(
          (uniqueBid) => uniqueBid.bidder === bid.bidder
        );
        uniqueBids[index] = bid;
        encounteredBidders[bid.bidder] = bid;
      }
    } else {
      uniqueBids.push(bid);
      encounteredBidders[bid.bidder] = bid;
    }
  });

  return uniqueBids;
}

const modifyFinalAuctionPrice = (
  auctionBids: any[],
  risePrice: string,
  supplyForSale: number
) => {
  const amountToAdd = BigInt(
    Number(risePrice.toString()) * supplyForSale * 0.8
  );

  const filtered = auctionBids.filter(
    (bid) => bid.bidder !== riseBurnerAddress
  );

  filtered.unshift({
    maxPrice: 10000000000000000000000n,
    depositAmount: amountToAdd,
    tokensWon: 0n,
    refundAmount: 0n,
    bidder: riseBurnerAddress,
  });

  return filtered;
};

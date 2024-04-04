require("dotenv").config();
import { ethers } from "ethers";
import { riseMulticallAbi } from "./riseMulticallAbi";
import { settleAuctionOffChain } from "./settleAuction";

const riseAuctionAddress = "0x473babee4a056e09abfce9d27ca4a1b1edb2b654";
const riseMulticallAddress = "0x19CA1311e8829a154E6CbBa036dCc922265a3c88";

const main = async () => {
  const baseProvider = new ethers.JsonRpcProvider(
    process.env.BASE_API_MAINNET_KEY
  );

  const riseMulticallInstance = new ethers.Contract(
    riseMulticallAddress,
    riseMulticallAbi,
    baseProvider
  );
  const info = await riseMulticallInstance.aggregateAllAuctionResults(
    riseAuctionAddress
  );

  let bidObject = [];
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  for (const bid of info[0]) {
    if (bid[4] !== zeroAddress) {
      let obj = {
        maxPrice: bid[0],
        depositAmount: bid[1],
        tokensWon: bid[2],
        refundAmount: bid[3],
        bidder: bid[4],
      };
      bidObject.push(obj);
    }
  }

  //info2 is supplyForSale
  //info1 is marketprice
  const settledData = await settleAuctionOffChain(
    bidObject,
    Number(info[2].toString()),
    info[1].toString()
  );

  console.log(settledData);
  return settledData;
};

main();

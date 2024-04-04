export const riseMulticallAbi = [
  {
    inputs: [
      { internalType: "address", name: "riseAuctionAddress", type: "address" },
    ],
    name: "aggregateAllAuctionResults",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "maxPrice", type: "uint256" },
          { internalType: "uint256", name: "depositAmount", type: "uint256" },
          { internalType: "uint256", name: "tokensWon", type: "uint256" },
          { internalType: "uint256", name: "refundAmount", type: "uint256" },
          { internalType: "address", name: "bidder", type: "address" },
        ],
        internalType: "struct RiseMulticall.BidData[]",
        name: "",
        type: "tuple[]",
      },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

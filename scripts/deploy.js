const hre = require('hardhat')

// cUSD addresses per network
const CUSD = {
  alfajores: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
  celo:      '0x765DE816845861e75A25fCA122bb6898B8B1282a',
}

async function main() {
  const network = hre.network.name
  console.log(`\nDeploying TaskEscrow to ${network}...`)

  const cusdAddress    = CUSD[network]
  const operatorAddr   = process.env.OPERATOR_ADDRESS
  const feeRecipient   = process.env.FEE_RECIPIENT
  const feeBps         = parseInt(process.env.FEE_BPS || '1500', 10)

  if (!cusdAddress)  throw new Error('Unknown network: ' + network)
  if (!operatorAddr) throw new Error('OPERATOR_ADDRESS not set in .env')
  if (!feeRecipient) throw new Error('FEE_RECIPIENT not set in .env')

  console.log('  cUSD:         ', cusdAddress)
  console.log('  operator:     ', operatorAddr)
  console.log('  feeRecipient: ', feeRecipient)
  console.log('  feeBps:       ', feeBps, `(${feeBps / 100}%)`)

  const TaskEscrow = await hre.ethers.getContractFactory('TaskEscrow')
  const escrow = await TaskEscrow.deploy(
    cusdAddress,
    operatorAddr,
    feeRecipient,
    feeBps
  )
  await escrow.waitForDeployment()

  const address = await escrow.getAddress()
  console.log(`\nTaskEscrow deployed at: ${address}`)
  console.log(`\nAdd to .env:`)

  if (network === 'alfajores') {
    console.log(`  NEXT_PUBLIC_ESCROW_ADDRESS_TESTNET=${address}`)
  } else {
    console.log(`  NEXT_PUBLIC_ESCROW_ADDRESS_MAINNET=${address}`)
  }

  console.log(`\nVerify with:`)
  console.log(
    `  npx hardhat verify --network ${network} ${address} ` +
    `"${cusdAddress}" "${operatorAddr}" "${feeRecipient}" ${feeBps}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

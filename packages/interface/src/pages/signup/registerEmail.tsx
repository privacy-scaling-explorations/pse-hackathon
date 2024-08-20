import { useState } from "react";
import { useRouter } from "next/router";
import { format } from "date-fns";
import { optimismSepolia } from "viem/chains";
import {
  Chain,
  encodeAbiParameters,
  http,
  parseAbiParameters,
  Transport,
} from "viem";
import { generatePrivateKey } from "viem/accounts";
import { privateKeyToAccount } from "viem/accounts";
import {
  createSmartAccountClient,
  ENTRYPOINT_ADDRESS_V07,
} from "permissionless";
import {
  paymasterClient,
  pimlicoBundlerClient,
  publicClient,
} from "~/utils/permissionless";
import {
  KernelEcdsaSmartAccount,
  signerToEcdsaKernelSmartAccount,
} from "permissionless/accounts";
import { Identity } from "@semaphore-protocol/core";
import { genKeyPair } from "maci-cli/sdk";

import { EligibilityDialog } from "~/components/EligibilityDialog";
import { Heading } from "~/components/ui/Heading";
import { config, semaphore, getPimlicoRPCURL } from "~/config";
import { FAQList } from "~/features/signup/components/FaqList";
import { Layout } from "~/layouts/DefaultLayout";
import { Form, FormControl, FormSection } from "~/components/ui/Form";
import { Input } from "~/components/ui/Input";
import {
  EmailFieldSchema,
  EmailField,
  OtpFieldSchema,
  OtpField,
} from "../../features/signup/types";
import { Button } from "~/components/ui/Button";
import SemaphoreAbi from "contracts/out/Semaphore.sol/Semaphore.json";

const RegisterEmail = (): JSX.Element => {
  const [emailField, setEmail] = useState<EmailField>();
  const router = useRouter();

  const registerEmail = async (emailField: EmailField) => {
    const url = "http://localhost:3001/send-otp";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailField),
      });

      if (!response.ok) {
        console.log(response.status);
        console.log(await response.json());
      } else {
        setEmail(emailField);
        console.log("OTP has been sent to ", emailField.email);
      }
    } catch (error: any) {
      console.error(error);
    }
  };

  const verifyOtp = async (otpField: OtpField) => {
    console.log("Verifying OTP: ", otpField.otp);
    const account = await generateEmbeddedAccount();

    const { email: email } = emailField!; // the component that can call this function only renders when the email exists
    const { otp: otp } = otpField;

    const signatureMessage = `Generate your EdDSA Key Pair at ${window.location.origin}`;
    const signature = await account.signMessage({ message: signatureMessage });

    const newSemaphoreIdentity = new Identity(signature);
    const userKeyPair = genKeyPair({ seed: BigInt(signature) });
    localStorage.setItem("maciPrivKey", userKeyPair.privateKey);
    localStorage.setItem("maciPubKey", userKeyPair.publicKey);
    localStorage.setItem(
      "semaphoreIdentity",
      newSemaphoreIdentity.privateKey.toString()
    );

    const identityCommitment = newSemaphoreIdentity.commitment;

    try {
      const url = "http://localhost:3001/verify-otp";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
          address: account.address,
          identityCommitment: identityCommitment.toString(),
        }),
      });

      if (!response.ok) {
        console.log(response.status);
        console.log(await response.json());
      } else {
        // // TODO: (merge-ok) sending tx here to test paymaster and smart account deployment. Remove later

        // const smartAccountClient = createSmartAccountClient({
        //   account,
        //   chain: optimismSepolia,
        //   bundlerTransport: http(getPimlicoRPCURL()),
        //   middleware: {
        //     sponsorUserOperation: paymasterClient.sponsorUserOperation,
        //     gasPrice: async () =>
        //       (await pimlicoBundlerClient.getUserOperationGasPrice()).fast,
        //   },
        // });

        // const wagmiAbi = [
        //   {
        //     name: "mint",
        //     type: "function",
        //     stateMutability: "nonpayable",
        //     inputs: [
        //       { internalType: "uint32", name: "tokenId", type: "uint32" },
        //     ],
        //     outputs: [],
        //   },
        // ] as const;

        // const { request } = await publicClient.simulateContract({
        //   address: "0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2",
        //   abi: wagmiAbi,
        //   functionName: "mint",
        //   args: [123],
        //   account,
        // });
        // const txHash = await smartAccountClient.writeContract(request);
        // console.log("txHash", txHash);

        // update state so that other options now show on signup page?
        router.push("/signup");
      }
    } catch (error: any) {
      console.error(error);
    }
  };

  const generateEmbeddedAccount = async () => {
    console.log("Generating new account");
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const kernelAccount = await signerToEcdsaKernelSmartAccount(publicClient, {
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      signer,
      index: 0n,
    });

    localStorage.setItem("ecdsaPrivKey", privateKey);
    localStorage.setItem("accountAddress", kernelAccount.address);
    return kernelAccount;
  };

  return (
    <Layout type="home">
      <EligibilityDialog />

      <div className="flex h-[90vh] w-screen flex-col items-center justify-center gap-4 bg-blue-50 dark:bg-black">
        <Heading className="max-w-screen-lg text-center" size="6xl">
          {config.eventName}
        </Heading>

        <Heading as="h2" className="max-w-screen-lg text-center" size="4xl">
          {config.roundId.toUpperCase()}
        </Heading>

        <p className="flex max-w-screen-md gap-2 text-center text-xl dark:text-gray-400">
          <span>
            {config.startsAt && format(config.startsAt, "d MMMM, yyyy")}
          </span>

          <span>-</span>

          <span>
            {config.resultsAt && format(config.resultsAt, "d MMMM, yyyy")}
          </span>
        </p>

        <Form
          schema={EmailFieldSchema}
          onSubmit={(email) => registerEmail(email)}
        >
          <FormSection
            description="Please register with your 'pse.dev' email."
            title="Register"
          >
            <FormControl
              required
              hint="This is your 'pse.dev' email address"
              label="Email address"
              name="email"
            >
              <Input placeholder="bob@pse.dev" />
            </FormControl>
            <Button
              suppressHydrationWarning
              size="auto"
              type="submit"
              variant="primary"
            >
              Submit
            </Button>
          </FormSection>
        </Form>
        {emailField && (
          <Form schema={OtpFieldSchema} onSubmit={(otp) => verifyOtp(otp)}>
            <FormSection
              description="Please enter the one-time-password (OTP) you recieved in your email"
              title="Enter OTP"
            >
              <FormControl
                required
                valueAsNumber
                hint="Check your 'pse.dev' inbox for the OTP"
                label="OTP"
                name="otp"
              >
                <Input placeholder="1234" type="number" />
              </FormControl>
              <Button
                suppressHydrationWarning
                size="auto"
                type="submit"
                variant="primary"
              >
                Verify OTP
              </Button>
            </FormSection>
          </Form>
        )}
      </div>

      <FAQList />
    </Layout>
  );
};

export default RegisterEmail;

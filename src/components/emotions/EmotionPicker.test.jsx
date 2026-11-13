import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import EmotionPicker from "./EmotionPicker.jsx";

/** The picker is "controlled", so the test supplies the state it needs. */
function PickerHarness({ initialIds = [] }) {
  const [selectedIds, setSelectedIds] = useState(initialIds);
  return (
    <>
      <EmotionPicker selectedIds={selectedIds} onChange={setSelectedIds} />
      <output data-testid="value">{selectedIds.join(",")}</output>
    </>
  );
}

const setup = (props) => {
  const user = userEvent.setup();
  render(<PickerHarness {...props} />);
  return user;
};
const value = () => screen.getByTestId("value").textContent;
const selectedChips = () => within(screen.getByRole("list", { name: "Selected emotions" })).getAllByRole("listitem");

describe("EmotionPicker", () => {
  it("starts with the six primary categories and no dropdowns", () => {
    setup();
    for (const label of ["Anger", "Disgust", "Sad", "Happy", "Surprise", "Fear"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lonely" })).not.toBeInTheDocument();
  });

  it("reveals secondary emotions when a category is opened", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Sad" }));

    const panel = screen.getByRole("region", { name: "Sad emotions" });
    for (const label of ["Guilty", "Abandoned", "Despair", "Depressed", "Lonely", "Bored"]) {
      expect(within(panel).getByRole("button", { name: label })).toBeInTheDocument();
    }
    // Opening a category does not select anything by itself.
    expect(value()).toBe("");
  });

  it("selects a secondary emotion and reveals its tertiary emotions", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Sad" }));
    await user.click(screen.getByRole("button", { name: "Lonely" }));

    expect(value()).toBe("sad.lonely");
    expect(screen.getByRole("button", { name: "Lonely" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Isolated" })).toBeInTheDocument();
    // "Abandoned" now exists twice (secondary + tertiary under Lonely).
    expect(screen.getAllByRole("button", { name: "Abandoned" })).toHaveLength(2);
  });

  it("can pick only a tertiary emotion using the arrow", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Sad" }));
    await user.click(screen.getByRole("button", { name: "More specific than Depressed" }));
    await user.click(screen.getByRole("button", { name: "Empty" }));

    expect(value()).toBe("sad.depressed.empty");
    expect(screen.getByRole("button", { name: "Depressed" })).toHaveAttribute("aria-pressed", "false");
  });

  it("quick-selects a primary category", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Fear" }));
    await user.click(screen.getByRole("button", { name: /Just “Fear”/ }));
    expect(value()).toBe("fear");
  });

  it("combines emotions from different categories and shows them as labelled chips", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Sad" }));
    await user.click(screen.getByRole("button", { name: "Lonely" }));
    await user.click(screen.getByRole("button", { name: "Bored" }));
    await user.click(screen.getByRole("button", { name: "Fear" }));
    await user.click(screen.getByRole("button", { name: "Anxious" }));
    await user.click(screen.getByRole("button", { name: "Rejected" }));

    expect(value()).toBe("sad.lonely,sad.bored,fear.anxious,fear.rejected");
    const chips = selectedChips();
    expect(chips.map((chip) => chip.textContent)).toEqual(["LonelySad", "BoredSad", "AnxiousFear", "RejectedFear"]);
    // The category cards show how many of their emotions are selected.
    expect(screen.getByRole("button", { name: "Sad, 2 selected" })).toBeInTheDocument();
  });

  it("removes an emotion from its chip or by tapping the card again", async () => {
    const user = setup({ initialIds: ["sad.lonely", "fear.anxious"] });

    await user.click(screen.getByRole("button", { name: "Remove Lonely" }));
    expect(value()).toBe("fear.anxious");

    await user.click(screen.getByRole("button", { name: /^Fear/ }));
    await user.click(screen.getByRole("button", { name: "Anxious" }));
    expect(value()).toBe("");
    expect(screen.queryByRole("list", { name: "Selected emotions" })).not.toBeInTheDocument();
  });

  it("works with the keyboard alone", async () => {
    const user = setup();
    screen.getByRole("button", { name: "Disgust" }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Awful" }).focus();
    await user.keyboard(" ");
    expect(value()).toBe("disgust.awful");
  });
});

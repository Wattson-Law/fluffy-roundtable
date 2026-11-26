"""Shared browser selectors: scope checks to the latest animal, not the reader or older evidence."""


def latest_pet(root):
    return (
        root.get_by_role("log", name="聊天记录")
        .locator('.round-message:not([data-speaker="user"])')
        .last
    )

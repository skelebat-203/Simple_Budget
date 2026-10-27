# v0.2 things that need to change
1. Item name and and type should be a single control. Replace with "Item".
    - When the user selects "Item" an option list of all perloaded and custom created items / categories should appear. As the user types that list should filter to include only items that could complete what they are typing. 
    - Categories should be larger and bold
    - Subcategories should be bold
    - Items should be normal font weight/style
    - The color coding from the table should be applyed to the options list.
    - Order by category -> subcategory -> alphabetical

2. I'm seeing a bunch of `style` attributes. We should not be using `style`, instead we must use reusable CSS classes for styling.

3. Amounts can be negative. There are times when an amount is a credit to an item. 

4. Estimated spend and recurrance should be in a separate flow.
    - Add a button at the top of the form, "Set estimates". when selected launch a "Budget setup" overlay. 
    - Budget setup:
        - Checkbox gorup - "Select the items you think you'll use regularly."
            - Supportive text - 'If you'd like to skip ahead just select "Save". Income, Tax, Emergency fund, Charity, and a few other items are preselected for you.'
            - this is not a required field group.
            - Once save is selected collapse but do not remove the list.
            - At the end of each category / subcat add a "Create" input. and an "add" button (disabled until a value is entered in the Create input. Add button includes `aria-describedby` referencing the input. This creates an item in the category/subcat.
        - Display, in an expander, a table with every selected item. 
            - Use the budget table category, sub-cat, and item structure and colors. But, there should be different columns. 
            - Columns: Item name, Estimated spending, Recurrance, Autopay.
            - the recurrance dropdown should only appear in income, debt, utlilities, and subscriptions.
            - the recurrance dropdown should be visually positioned as "pre" {control} side by side not stacked. 
            - Estimated spending inputs are named by `aria-labelledby` referencing "Estimated spending" col header text and `aria-describedby` referencing the item name.
            - Categories and subcats do not display these controls (they are only there to aid in visual understanding)
                - Charity is an exception. If Charity is the only selected item in the Charity category, it should display the controls.
            - Autopay should appear for debt, utlilities, and subscriptions.
        - Default display range toggle: day, week, month.

5. Bi-monthly means twice a month, not every 2 months. Correct this to "Bi-monthly"

6. The table is not honoring the scheme defined.


I cannot do the a11y review because so much of the UI/UX needs to be refactored. 
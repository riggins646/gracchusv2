# CH lookup review

Medium-confidence matches and no-match cases — manual review needed.
Either correct the entry directly in `src/data/supplier-companies-house.json`,
or refine the CH search query.

- `supplier-skanska-construction` (Skanska Construction UK Limited) -> conflicting project-contractor CH values: {'00191408': 2, '01449212': 3}
- `supplier-mace` (Mace Limited) -> conflicting project-contractor CH values: {'02410626': 2, '03149000': 3}
- `supplier-balfour-beatty-group` (Balfour Beatty Group Limited) -> conflicting project-contractor CH values: {'00101073': 10, '00395826': 1}
- `supplier-balfour-beatty` (Balfour Beatty plc) -> conflicting project-contractor CH values: {'00101073': 10, '00395826': 1}
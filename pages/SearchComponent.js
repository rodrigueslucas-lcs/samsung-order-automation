import BasePage from "./BasePage";
export default class SearchComponent extends BasePage {
 constructor(page) {
   super(page);
   this.searchButton = page.getByRole("button", {
     name: /Buscar|Search/i,
   });
   this.searchInput = page.getByRole("textbox", {
     name: "Search",
   });
 }
 async openSearch() {
   await this.searchButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await this.searchButton.click();
   await this.searchInput.waitFor({
     state: "visible",
     timeout: 30000,
   });
 }
  async validateAutocompleteToSt2Pdp() {
   await this.openSearch();
   await this.searchInput.fill("RB45DG6300B1PE");
   const suggestedSearches = this.page.getByRole("heading", {
     name: "Búsquedas sugeridas",
     level: 3,
   });
   await suggestedSearches.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const skuSuggestion = this.page
     .getByRole("listitem")
     .filter({
       hasText: /^RB45DG6300B1PE$/,
     })
     .first();
   await skuSuggestion.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const relatedProductsHeading = this.page.getByRole("heading", {
     name: "PRODUCTOS RELACIONADOS",
     level: 3,
   });
   const relatedProductsAvailable = await relatedProductsHeading
     .isVisible()
     .catch(() => false);
   await this.screenshot("search-autocomplete-suggestions");
   if (!relatedProductsAvailable) {
     return {
       autocompleteVisible: true,
       relatedProductAvailable: false,
     };
   }
   const productResult = this.page
     .getByRole("menu")
     .getByRole("listitem")
     .filter({
       hasText: /Refrigeradora Bottom Freezer 409L Black C\/Disp\./i,
     });
   await productResult.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await this.screenshot("search-autocomplete-related-product");
   await productResult.click();
   await this.page.waitForURL(
     (url) => {
       const validHost = [
         "stg2.shop.samsung.com",
         "www.samsung.com",
       ].includes(url.hostname);
       return (
         validHost &&
         url.pathname.startsWith("/pe/") &&
         url.pathname.toLowerCase().includes("rb45dg6300b1pe")
       );
     },
     {
       timeout: 30000,
     }
   );
   const sku = this.page
     .getByText("RB45DG6300B1PE", {
       exact: true,
     })
     .first();
   await sku.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await this.screenshot("search-autocomplete-product-pdp");
   return {
     autocompleteVisible: true,
     relatedProductAvailable: true,
   };
 }
}

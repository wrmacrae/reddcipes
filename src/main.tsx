// Learn more at developers.reddit.com/docs
import { Devvit, useState } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
});

// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: "Grandma's Snickerdoodle Cookies",
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    ui.showToast("Submitting your post - upon completion you'll navigate there.");

    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: 'My devvit post',
      subredditName: subreddit.name,
      // The preview appears while the post loads
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading ...</text>
        </vstack>
      ),
    });
    ui.navigateTo(post);
  },
});

// Add a post type definition
Devvit.addCustomPostType({
  name: 'Experience Post',
  height: 'regular',
  render: (_context) => {
    const [showInstructions, setShowInstructions] = useState(false);

    return (
      <vstack height="100%" width="100%" gap="medium" alignment="center middle">
        <hstack width="95%">
          <vstack width="35%" alignment="middle">
            <text wrap>Makes about 2 dozen</text>
            <spacer></spacer>
            <text wrap>Ingredients:</text>
            <text size="small" wrap>1 1/2 C sugar</text>
            <text size="small" wrap>1C butter, roomish temp</text>
            <text size="small" wrap>2 eggs</text>
            <text size="small" wrap>2 3/4 C flour (375g)</text>
            <text size="small" wrap>1 tsp baking soda</text>
            <text size="small" wrap>1/4 tsp salt</text>
            <text size="small" wrap>2 tsp cream of tartar</text>
            <spacer></spacer>
            <text wrap>For rolling:</text>
            <text size="small" wrap>3 Tbsp sugar</text>
            <text size="small" wrap>3 tsp cinnamon</text>
            <spacer></spacer>
            <button width="93%" onPress={() => setShowInstructions(!showInstructions)}>{showInstructions ? "Picture" : "Instructions"}</button>
          </vstack>
          { showInstructions ?
          <vstack gap="none">
            <text size="small" wrap>This makes a pretty stiff dough so is best done with an electric mixer.</text>
            <spacer></spacer>
            <text size="small" wrap>1. Cream together sugar and butter</text>
            <text size="small" wrap>2. Add eggs and mix well</text>
            <text size="small" wrap>3. In separate bowl, mix dry ingredients (flour, baking soda, salt, cream of tartar)</text>
            <text size="small" wrap>4. Add dry ingredients to wet, in two or three additions</text>
            <text size="small" wrap>5. Chill dough for at least 30 min</text>
            <text size="small" wrap>6. Roll dough into balls approx 1.5”</text>
            <text size="small" wrap>7. Roll balls in cinnamon/sugar mixture</text>
            <text size="small" wrap>8. Bake on ungreased cookie sheet at 400° for 9 minutes</text>
            <text size="small" wrap>9. Let cool on rack and enjoy ❤️</text>
          </vstack>
          :
          <image
            url="my-grandmas-snickerdoodles-recipe-barely-saved-from-being-v0-5o39g3k32lv91.jpeg"
            description="cookie"
            imageHeight={480}
            imageWidth={640}
            height="300px"
            width="400px"
          />
          }
        </hstack>
      </vstack>
    );
  },
});

export default Devvit;

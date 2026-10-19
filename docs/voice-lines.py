# every English line the game speaks, grouped into audio sprites
WORLDS = {
 'unicorn': ['fairy','mermaid','prince','dragon','swan','diamond','ribbon','bouquet','carousel','magic wand'],
 'sweets': ['candle','present','balloon','pancake','waffle','pudding','honey','popcorn','cherry','watermelon'],
 'colors': ['brown','black','white','gray','gold','silver','sky blue','navy'],
 'cars': ['siren','traffic light','firefighter','police officer','fire extinguisher','school bus','tractor','motorcycle','rocket','sailboat'],
 'halloween': ["jack-o'-lantern",'vampire','zombie','broom','potion','spider web','crystal ball','full moon','skull'],
}
def world_lines(wid):
    out = []
    for w in WORLDS[wid]:
        the = f'the {w} one' if wid == 'colors' else f'the {w}'
        out += [w[0].upper() + w[1:] + '.', f'Go get {the}!', f'Jump for {the}!', f'Pop {the}!']
    return out
LETTERS = {'A':'ay','B':'bee','C':'see','D':'dee','E':'ee','F':'eff','G':'jee','H':'aitch','I':'eye','J':'jay','K':'kay','L':'el','M':'em',
           'N':'en','O':'oh','P':'pee','Q':'cue','R':'are','S':'ess','T':'tee','U':'you','V':'vee','W':'double you','X':'ex','Y':'why','Z':'zee'}
COMMON = ['Great job!','Yay!','You did it!','Wonderful!','Super!','Hooray!',
  'Princess Castle!','Birthday Party!','Color Land!','Rescue Team!','Halloween Party!','Mix it up!',
  'Worm game!','Jump game!','Balloon game!','Sticker book!','Dress up!','All clear!','Wow!','Find me in a game!',
  'Great job! Look at all your stars!',
  'Ready, set, go!','New sticker!','Bonus stars!',"Let's learn new words!","Let's play!",'Try it on!','So pretty!',"Let's get more stars!",'Listen!',
  'pink dress','candy dress','starry dress','pumpkin dress','firefighter suit','rainbow dress','mermaid dress','princess gown',
  'bow','tiara','flower crown','cat ears','police hat','witch hat','unicorn horn','crown',
  'brown hair','black hair','blonde hair','pink hair','purple hair','mint hair','rainbow hair',
  'fairy wings','butterfly wings','bat wings','angel wings','rainbow wings',
  'lollipop','ice cream','pumpkin basket','kitten','puppy','bunny','unicorn','baby dragon',
  'rainbow sky','candy land','spooky night','castle','under the sea']
